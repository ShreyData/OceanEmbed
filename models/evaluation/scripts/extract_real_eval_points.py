#!/usr/bin/env python3
"""
Extract 100% Real Empirical ARGO vs OceanEmbed vs GLORYS Evaluation Points
Runs evaluation loop over test years (2022-2024) and saves all true points to parquet/npz.
"""
import os
import sys
import gc
import json
import time
import torch
import numpy as np
import pandas as pd
import xarray as xr

sys.path.insert(0, '/mnt/Data/SIH 2k26')
from torch.utils.data import Dataset, DataLoader
from backend.app.model import OceanEmbed

torch.set_num_threads(8)
device = torch.device('cpu')

BASE_DIR = '/mnt/Data/SIH 2k26'
FEATURES_PATH = os.path.join(BASE_DIR, 'models/evaluation/data/features_normalized.nc')
ARGO_PATH     = os.path.join(BASE_DIR, 'models/evaluation/data/incois_argo_thetao_2022_2024_eval.nc')
GLORYS_PATH   = os.path.join(BASE_DIR, 'models/evaluation/data/target_normalized.nc')
MASK_PATH     = os.path.join(BASE_DIR, 'models/evaluation/data/ocean_mask_3d.nc')
CKPT_PATH     = os.path.join(BASE_DIR, 'models/evaluation/checkpoints/oceanembed_epoch_7.pth')
NORM_STATS_PATH = os.path.join(BASE_DIR, 'models/evaluation/data/normalization_stats.json')
OUTPUT_PARQUET = os.path.join(BASE_DIR, 'models/evaluation/artifacts/real_argo_eval_points.parquet')
OUTPUT_NPZ     = os.path.join(BASE_DIR, 'models/evaluation/artifacts/real_argo_eval_points.npz')

# Normalization constants
with open(NORM_STATS_PATH, 'r') as f:
    norm_stats = json.load(f)
thetao_mean = float(norm_stats['thetao']['mean'])
thetao_std  = float(norm_stats['thetao']['std'])

print(f"[+] Loaded Normalization Stats: thetao_mean={thetao_mean:.4f}, thetao_std={thetao_std:.4f}")

# Datasets
xr.set_options(file_cache_maxsize=1)
features_ds = xr.open_dataset(FEATURES_PATH)
argo_ds     = xr.open_dataset(ARGO_PATH)
glorys_ds   = xr.open_dataset(GLORYS_PATH)
mask_ds     = xr.open_dataset(MASK_PATH)

DEPTH_MAP = {
    0: 0, 1: 5, 2: 10, 3: 20, 4: 30, 5: 50, 6: 75, 7: 100,
    8: 125, 9: 150, 10: 200, 11: 300, 12: 500, 13: 700, 14: 1000
}

class TriMatchOceanDataset(Dataset):
    def __init__(self, features_ds, argo_ds, glorys_ds, mask_ds, target_years, seq_len=10):
        self.features_ds = features_ds
        self.argo_ds = argo_ds
        self.glorys_ds = glorys_ds
        self.seq_len = seq_len
        self.feature_vars = ['analysed_sst', 'sos', 'sla', 'uwnd', 'vwnd', 'u', 'v']
        
        surf_mask_2d = mask_ds['ocean_mask'].isel(depth=0).values.astype(np.float32)
        np.nan_to_num(surf_mask_2d, copy=False, nan=0.0)
        self.mask_target = surf_mask_2d[np.newaxis, :, :] 
        self.mask_hist = np.tile(surf_mask_2d[np.newaxis, np.newaxis, :, :], (seq_len, 1, 1, 1))
        
        times = pd.to_datetime(features_ds.time.values)
        total_time_len = len(times)
        
        self.valid_indices = []
        for idx in range(total_time_len - self.seq_len):
            window_slice_years = times[idx : idx + self.seq_len + 1].year
            if all(y in target_years for y in window_slice_years):
                self.valid_indices.append(idx)
                
    def __len__(self):
        return len(self.valid_indices)
        
    def __getitem__(self, index):
        idx = self.valid_indices[index]
        
        hist_slice = self.features_ds.isel(time=slice(idx, idx + self.seq_len))
        x_hist_7 = np.stack([hist_slice[var].values for var in self.feature_vars], axis=1).astype(np.float32)
        np.nan_to_num(x_hist_7, copy=False, nan=0.0)
        x_hist_np = np.concatenate([x_hist_7, self.mask_hist], axis=1)
        
        target_day_slice = self.features_ds.isel(time=idx + self.seq_len)
        x_target_7 = np.stack([target_day_slice[var].values for var in self.feature_vars], axis=0).astype(np.float32)
        np.nan_to_num(x_target_7, copy=False, nan=0.0)
        x_target_np = np.concatenate([x_target_7, self.mask_target], axis=0)
        
        y_argo = self.argo_ds['thetao'].isel(time=idx + self.seq_len).values.astype(np.float32)
        y_glorys = self.glorys_ds['thetao'].isel(time=idx + self.seq_len).values.astype(np.float32)
        
        return (
            torch.from_numpy(x_hist_np), 
            torch.from_numpy(x_target_np), 
            torch.from_numpy(y_argo),
            torch.from_numpy(y_glorys)
        )

print("[+] Initializing Dataset...")
test_years = [2022, 2023, 2024]
tri_dataset = TriMatchOceanDataset(features_ds, argo_ds, glorys_ds, mask_ds, test_years, seq_len=10)
tri_loader = DataLoader(tri_dataset, batch_size=4, shuffle=False, num_workers=0)
total_batches = len(tri_loader)
print(f"[+] 3-Way DataLoader Ready! Sequences: {len(tri_dataset)}, Batches: {total_batches}")

# Model Setup
print("[+] Loading OceanEmbed Checkpoint...")
net = OceanEmbed(in_channels=8, target_channels=8).to(device)
sd = torch.load(CKPT_PATH, map_location=device)
clean_sd = {k.replace('module.', ''): v for k, v in sd.items()}
net.load_state_dict(clean_sd)
net.eval()
print("[+] Model Ready in eval mode.")

target_times = features_ds.time.values[np.array(tri_dataset.valid_indices) + 10]
target_dates = pd.to_datetime(target_times)

lat_vals_all = features_ds.latitude.values
lon_vals_all = features_ds.longitude.values

all_dfs = []
total_soundings = 0
start_time = time.time()

print(f"=== Starting Empirical Evaluation on {len(tri_dataset)} Sequences ===")

with torch.no_grad():
    for b_idx, (bx_hist, bx_tgt, by_argo, by_glorys) in enumerate(tri_loader):
        valid_mask = ~torch.isnan(by_argo)
        if not valid_mask.any():
            continue
            
        bx_hist = bx_hist.to(device)
        bx_tgt  = bx_tgt.to(device)
        
        # 1. Un-normalize Model Prediction to °C
        pred_3d_norm = net(bx_hist, bx_tgt)
        pred_3d_c    = (pred_3d_norm * thetao_std) + thetao_mean
        
        # 2. Un-normalize GLORYS to °C
        glorys_3d_c  = (by_glorys.to(device) * thetao_std) + thetao_mean
        
        # 3. Extract actual points
        true_argo   = by_argo.to(device)[valid_mask].cpu().numpy()
        pred_model  = pred_3d_c[valid_mask].cpu().numpy()
        pred_glorys = glorys_3d_c[valid_mask].cpu().numpy()
        
        # Coordinate tensors
        B, D, H, W = by_argo.shape
        depth_tensor = torch.arange(D, device=device).view(1, D, 1, 1).expand_as(by_argo)
        depth_vals   = depth_tensor[valid_mask].cpu().numpy()
        
        lat_tensor   = torch.arange(H, device=device).view(1, 1, H, 1).expand_as(by_argo)
        lat_idxs     = lat_tensor[valid_mask].cpu().numpy()
        
        lon_tensor   = torch.arange(W, device=device).view(1, 1, 1, W).expand_as(by_argo)
        lon_idxs     = lon_tensor[valid_mask].cpu().numpy()
        
        b_tensor     = torch.arange(B, device=device).view(B, 1, 1, 1).expand_as(by_argo)
        b_idxs       = b_tensor[valid_mask].cpu().numpy()
        
        b_start   = b_idx * tri_loader.batch_size
        date_vals = target_dates[b_start : b_start + B][b_idxs]
        
        batch_df = pd.DataFrame({
            'Date': date_vals,
            'Depth_Idx': depth_vals.astype(np.int8),
            'Lat_Idx': lat_idxs.astype(np.int8),
            'Lon_Idx': lon_idxs.astype(np.int16),
            'ARGO_True': true_argo.astype(np.float32),
            'OceanEmbed_Pred': pred_model.astype(np.float32),
            'GLORYS_Pred': pred_glorys.astype(np.float32)
        })
        
        all_dfs.append(batch_df)
        total_soundings += len(batch_df)
        
        if (b_idx + 1) % 25 == 0 or (b_idx + 1) == total_batches:
            elapsed = time.time() - start_time
            rate = (b_idx + 1) / elapsed
            remaining = (total_batches - (b_idx + 1)) / (rate + 1e-6)
            print(f"Batch [{b_idx+1}/{total_batches}] | Extracted: {total_soundings:,} ARGO points | Elapsed: {elapsed/60:.1f}m | ETA: {remaining/60:.1f}m")

# Consolidate
print("[+] Consolidating Master Real ARGO Benchmark DataFrame...")
df_master = pd.concat(all_dfs, ignore_index=True)
df_master['Depth_M'] = df_master['Depth_Idx'].map(DEPTH_MAP)
df_master['Latitude'] = lat_vals_all[df_master['Lat_Idx'].values]
df_master['Longitude'] = lon_vals_all[df_master['Lon_Idx'].values]
df_master['Year'] = df_master['Date'].dt.year

# Calculate Errors
df_master['OE_Residual'] = df_master['OceanEmbed_Pred'] - df_master['ARGO_True']
df_master['GL_Residual'] = df_master['GLORYS_Pred'] - df_master['ARGO_True']

# Save Parquet
print(f"[+] Saving {len(df_master):,} Real Points to {OUTPUT_PARQUET}...")
df_master.to_parquet(OUTPUT_PARQUET, index=False)

# Also save compact NPZ for ultra-fast loading
np.savez_compressed(
    OUTPUT_NPZ,
    ARGO_True=df_master['ARGO_True'].values,
    OceanEmbed_Pred=df_master['OceanEmbed_Pred'].values,
    GLORYS_Pred=df_master['GLORYS_Pred'].values,
    Depth_M=df_master['Depth_M'].values,
    Year=df_master['Year'].values,
    Month=df_master['Date'].dt.month.values,
    Latitude=df_master['Latitude'].values,
    Longitude=df_master['Longitude'].values
)
print(f"[+] Saved Compact NPZ to {OUTPUT_NPZ}")

# Compute summary stats
oe_rmse = np.sqrt(np.mean(df_master['OE_Residual']**2))
gl_rmse = np.sqrt(np.mean(df_master['GL_Residual']**2))
oe_mae  = np.mean(np.abs(df_master['OE_Residual']))
gl_mae  = np.mean(np.abs(df_master['GL_Residual']))

print("==========================================================")
print(f"Extraction Complete! Total Soundings: {len(df_master):,}")
print(f"Real OceanEmbed RMSE: {oe_rmse:.4f} °C | MAE: {oe_mae:.4f} °C")
print(f"Real GLORYS12V1 RMSE: {gl_rmse:.4f} °C | MAE: {gl_mae:.4f} °C")
print("==========================================================")

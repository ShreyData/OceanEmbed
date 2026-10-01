"""
OceanEmbed PyTorch Architecture — exactly as trained.

Classes:
  TemporalScaleMixer      Module 1: Multi-scale temporal Conv3D branches
  ConvLSTMCell            Module 2a: Single-step ConvLSTM cell
  SpatiotemporalConvLSTM  Module 2: Unrolled ConvLSTM over 10-day history
  DoubleConv, Down, Up    Module 3 U-Net building blocks
  HASPP                   Module 3 Bottleneck: Hierarchical Atrous SPP
  SFFM_UNet               Module 3: Dual-branch U-Net decoder
  OceanEmbed              Master wrapper
"""
import torch
import torch.nn as nn
import torch.nn.functional as F


# ─────────────────────────────────────────────────────────────────────────────
# Module 1: Temporal Scale Mixer
# ─────────────────────────────────────────────────────────────────────────────
class TemporalScaleMixer(nn.Module):
    """Three parallel Conv3D branches capturing short/medium/long temporal patterns."""

    def __init__(self, in_channels: int = 8, branch_channels: int = 16):
        super().__init__()
        self.branch_a = nn.Sequential(
            nn.Conv3d(in_channels, branch_channels, kernel_size=(2, 1, 1), stride=(2, 1, 1)),
            nn.BatchNorm3d(branch_channels),
            nn.ReLU(inplace=True),
        )
        self.branch_b = nn.Sequential(
            nn.Conv3d(in_channels, branch_channels, kernel_size=(5, 1, 1), stride=(5, 1, 1)),
            nn.BatchNorm3d(branch_channels),
            nn.ReLU(inplace=True),
        )
        self.branch_c = nn.Sequential(
            nn.Conv3d(in_channels, branch_channels, kernel_size=(10, 1, 1), stride=(10, 1, 1)),
            nn.BatchNorm3d(branch_channels),
            nn.ReLU(inplace=True),
        )

    def forward(self, x: torch.Tensor) -> torch.Tensor:
        # x: (B, T=10, C, H, W) → permute to (B, C, T, H, W) for Conv3d
        x = x.permute(0, 2, 1, 3, 4)
        out_a = self.branch_a(x)
        out_b = self.branch_b(x)
        out_c = self.branch_c(x)
        target_size = (10, x.shape[3], x.shape[4])
        out_a = F.interpolate(out_a, size=target_size, mode="nearest")
        out_b = F.interpolate(out_b, size=target_size, mode="nearest")
        out_c = F.interpolate(out_c, size=target_size, mode="nearest")
        # C = 8 + 16 + 16 + 16 = 56 channels
        mixed = torch.cat([x, out_a, out_b, out_c], dim=1)
        return mixed.permute(0, 2, 1, 3, 4)  # (B, T, 56, H, W)


# ─────────────────────────────────────────────────────────────────────────────
# Module 2: Spatiotemporal ConvLSTM
# ─────────────────────────────────────────────────────────────────────────────
class ConvLSTMCell(nn.Module):
    def __init__(self, input_dim: int, hidden_dim: int, kernel_size: int = 3):
        super().__init__()
        self.hidden_dim = hidden_dim
        padding = kernel_size // 2
        self.conv = nn.Conv2d(
            in_channels=input_dim + hidden_dim,
            out_channels=4 * hidden_dim,
            kernel_size=kernel_size,
            padding=padding,
        )

    def forward(self, x: torch.Tensor, state: tuple) -> tuple:
        h, c = state
        gates = self.conv(torch.cat([x, h], dim=1))
        i, f, g, o = torch.chunk(gates, 4, dim=1)
        i, f, o = torch.sigmoid(i), torch.sigmoid(f), torch.sigmoid(o)
        g = torch.tanh(g)
        c_next = f * c + i * g
        h_next = o * torch.tanh(c_next)
        return h_next, c_next


class SpatiotemporalConvLSTM(nn.Module):
    def __init__(self, input_dim: int = 56, hidden_dim: int = 32, kernel_size: int = 3):
        super().__init__()
        self.hidden_dim = hidden_dim
        self.cell = ConvLSTMCell(input_dim, hidden_dim, kernel_size)

    def forward(self, x: torch.Tensor) -> torch.Tensor:
        B, T, C, H, W = x.shape
        h = torch.zeros(B, self.hidden_dim, H, W, device=x.device)
        c = torch.zeros(B, self.hidden_dim, H, W, device=x.device)
        for t in range(T):
            h, c = self.cell(x[:, t], (h, c))
        return h  # (B, 32, H, W)


# ─────────────────────────────────────────────────────────────────────────────
# Module 3: U-Net building blocks
# ─────────────────────────────────────────────────────────────────────────────
class DoubleConv(nn.Module):
    def __init__(self, in_channels: int, out_channels: int):
        super().__init__()
        self.double_conv = nn.Sequential(
            nn.Conv2d(in_channels, out_channels, kernel_size=3, padding=1),
            nn.BatchNorm2d(out_channels),
            nn.ReLU(inplace=True),
            nn.Conv2d(out_channels, out_channels, kernel_size=3, padding=1),
            nn.BatchNorm2d(out_channels),
            nn.ReLU(inplace=True),
        )

    def forward(self, x: torch.Tensor) -> torch.Tensor:
        return self.double_conv(x)


class Down(nn.Module):
    def __init__(self, in_channels: int, out_channels: int):
        super().__init__()
        self.maxpool_conv = nn.Sequential(nn.MaxPool2d(2), DoubleConv(in_channels, out_channels))

    def forward(self, x: torch.Tensor) -> torch.Tensor:
        return self.maxpool_conv(x)


class Up(nn.Module):
    def __init__(self, in_channels: int, out_channels: int):
        super().__init__()
        self.conv = DoubleConv(in_channels, out_channels)

    def forward(self, x1: torch.Tensor, x2: torch.Tensor) -> torch.Tensor:
        x1 = F.interpolate(x1, size=x2.shape[2:], mode="bilinear", align_corners=True)
        return self.conv(torch.cat([x2, x1], dim=1))


class HASPP(nn.Module):
    """Hierarchical Atrous Spatial Pyramid Pooling.
    dims = out_channels // 5 = 256 // 5 = 51 → 5*51=255 → project to 256.
    """

    def __init__(self, in_channels: int, out_channels: int):
        super().__init__()
        dims = out_channels // 5
        self.aspp1 = nn.Sequential(
            nn.Conv2d(in_channels, dims, 1, bias=False), nn.BatchNorm2d(dims), nn.ReLU(inplace=True)
        )
        self.aspp2 = nn.Sequential(
            nn.Conv2d(in_channels, dims, 3, padding=6, dilation=6, bias=False),
            nn.BatchNorm2d(dims), nn.ReLU(inplace=True),
        )
        self.aspp3 = nn.Sequential(
            nn.Conv2d(in_channels, dims, 3, padding=12, dilation=12, bias=False),
            nn.BatchNorm2d(dims), nn.ReLU(inplace=True),
        )
        self.aspp4 = nn.Sequential(
            nn.Conv2d(in_channels, dims, 3, padding=18, dilation=18, bias=False),
            nn.BatchNorm2d(dims), nn.ReLU(inplace=True),
        )
        self.global_pool = nn.Sequential(
            nn.AdaptiveAvgPool2d(1),
            nn.Conv2d(in_channels, dims, 1, bias=False), nn.BatchNorm2d(dims), nn.ReLU(inplace=True),
        )
        self.project = nn.Sequential(
            nn.Conv2d(dims * 5, out_channels, 1, bias=False),
            nn.BatchNorm2d(out_channels), nn.ReLU(inplace=True), nn.Dropout2d(0.15),
        )

    def forward(self, x: torch.Tensor) -> torch.Tensor:
        x5 = F.interpolate(self.global_pool(x), size=x.shape[2:], mode="bilinear", align_corners=True)
        return self.project(torch.cat([self.aspp1(x), self.aspp2(x), self.aspp3(x), self.aspp4(x), x5], dim=1))


class SFFM_UNet(nn.Module):
    """Dual-branch U-Net with HASPP bottleneck. Outputs 15 depth levels."""

    def __init__(self, hist_channels: int = 32, target_channels: int = 8, out_depths: int = 15):
        super().__init__()
        base = 64
        self.inc_h = DoubleConv(hist_channels, base)
        self.inc_x = DoubleConv(target_channels, base)
        self.down1 = Down(base, base * 2)
        self.down2 = Down(base * 2, base * 4)
        self.haspp = HASPP(base * 4, base * 4)
        self.up1   = Up(base * 4 + base * 2, base * 2)
        self.up2   = Up(base * 2 + base, base)
        self.final_refinement = nn.Sequential(
            DoubleConv(base, base),
            nn.Conv2d(base, out_depths, kernel_size=1),
        )

    def forward(self, h_hist: torch.Tensor, x_target: torch.Tensor) -> torch.Tensor:
        feat_h = self.inc_h(h_hist)
        feat_x = self.inc_x(x_target)
        x1 = feat_h + feat_x         # additive fusion, skip-1
        x2 = self.down1(x1)          # skip-2
        x3 = self.haspp(self.down2(x2))
        x  = self.up2(self.up1(x3, x2), x1)
        return self.final_refinement(x)  # (B, 15, H, W)


# ─────────────────────────────────────────────────────────────────────────────
# Master Wrapper
# ─────────────────────────────────────────────────────────────────────────────
class OceanEmbed(nn.Module):
    """OceanEmbed v2.
    Forward:
        x_history    (B, 10, 8, H, W)
        x_target_day (B, 8,  H, W)
        → output     (B, 15, H, W)  z-score normalised thetao
    """

    def __init__(
        self,
        in_channels: int = 8,
        mixer_branches: int = 16,
        lstm_hidden: int = 32,
        target_channels: int = 8,
        out_depths: int = 15,
    ):
        super().__init__()
        self.ts_mixer  = TemporalScaleMixer(in_channels, mixer_branches)
        self.conv_lstm = SpatiotemporalConvLSTM(
            input_dim=in_channels + 3 * mixer_branches,  # 56
            hidden_dim=lstm_hidden,
        )
        self.sffm = SFFM_UNet(lstm_hidden, target_channels, out_depths)

    def forward(self, x_history: torch.Tensor, x_target_day: torch.Tensor) -> torch.Tensor:
        return self.sffm(self.conv_lstm(self.ts_mixer(x_history)), x_target_day)

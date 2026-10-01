#!/usr/bin/env python3
"""01_login.py: Authenticate with the Copernicus Marine API."""

import copernicusmarine
import sys

def main():
    print("=" * 60)
    print("COPERNICUS MARINE AUTHENTICATION")
    print("=" * 60)
    try:
        # Prompts for username/password and stores credentials locally
        copernicusmarine.login()
        print("\n[SUCCESS] Authentication credentials saved successfully!")
    except Exception as e:
        print(f"\n[ERROR] Authentication failed: {e}", file=sys.stderr)
        sys.exit(1)

if __name__ == "__main__":
    main()
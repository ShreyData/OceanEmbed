#!/usr/bin/env python3
"""
00_nasa_login.py: Generates persistent Earthdata credentials.
"""
import earthaccess

def main():
    print("Authenticating with NASA Earthdata...")
    # This will prompt for username/password if not already cached
    earthaccess.login(persist=True)
    print("✅ Credentials successfully saved to ~/.netrc. You can now run the downloaders.")

if __name__ == "__main__":
    main()
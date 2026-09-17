import urllib.request
import time
import subprocess
import sys

print("Waiting for backend API to be ready on port 8000...")
for _ in range(60):
    try:
        response = urllib.request.urlopen("http://localhost:8000/health")
        if response.getcode() == 200:
            print("API is ready!")
            break
    except Exception:
        pass
    time.sleep(2)
else:
    print("API failed to start in time.")
    sys.exit(1)

print("Running database initialization...")
subprocess.run([r".\.venv\Scripts\python", r"scripts\init_db.py"], check=True)
print("Importing dataset...")
subprocess.run([r".\.venv\Scripts\python", r"scripts\import_glorys.py"], check=True)
print("All done!")

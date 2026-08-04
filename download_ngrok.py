import urllib.request
import zipfile
import os

url = "https://bin.equinox.io/c/bNyj1mQVY4c/ngrok-v3-stable-windows-amd64.zip"
zip_path = "ngrok_py.zip"

print("Downloading ngrok...")
urllib.request.urlretrieve(url, zip_path)

print("Extracting...")
with zipfile.ZipFile(zip_path, 'r') as zip_ref:
    zip_ref.extractall(".")
    
print("ngrok is extracted successfully to ngrok.exe")
os.remove(zip_path)

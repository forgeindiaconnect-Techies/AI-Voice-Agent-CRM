import requests

res1 = requests.post("http://localhost:8000/api/auth/login", json={"email": "tl@forgeindia.com", "password": "Leader@123"})
if res1.status_code == 200:
    token = res1.json()["access_token"]
    res2 = requests.get("http://localhost:8000/api/leads", headers={"Authorization": f"Bearer {token}"})
    print("STATUS:", res2.status_code)
    try:
        leads_data = res2.json()
        print("IS_LIST:", isinstance(leads_data, list))
        print("LENGTH:", len(leads_data) if isinstance(leads_data, list) else 0)
        print("First item:", leads_data[0] if isinstance(leads_data, list) and len(leads_data) > 0 else leads_data)
    except Exception as e:
        print("Error parsing JSON:", e)
else:
    print("Login failed:", res1.text)

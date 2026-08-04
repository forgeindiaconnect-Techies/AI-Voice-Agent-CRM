import requests
r = requests.post("https://grumpy-impalas-teach.loca.lt/api/calls/twiml", data={"To": "+1234567890", "From": "+0987654321"})
print(r.status_code)
print(r.text)

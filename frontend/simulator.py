import random, uuid
from datetime import datetime

class SimulationEngine:
    def __init__(self):
        self.accounts=["ACC-1042","ACC-2188","ACC-3321","ACC-4077","ACC-5184","ACC-6210","ACC-7304"]
        self.merchants=["MetroMart","QuickPay","Nexa Retail","UrbanFuel","CloudStore","TravelHub"]
        self.locations=["Bhopal","Indore","Delhi","Pune","Mumbai"]
        self.step=0
        self.fraud_accounts=["ACC-9001","ACC-9002","ACC-9003","ACC-9004"]

    def normal_transaction(self, ts):
        return {"id":"TX-"+uuid.uuid4().hex[:10].upper(),"account_id":random.choice(self.accounts),
                "device_id":"DEV-"+str(random.randint(100,180)),"merchant":random.choice(self.merchants),
                "amount":round(random.uniform(250,4200),2),"location":random.choice(self.locations[:3]),
                "ip":f"10.0.{random.randint(1,20)}.{random.randint(10,240)}","timestamp":ts}

    def next(self, scenario):
        self.step+=1
        now=datetime.utcnow()
        if scenario=="coordinated_fraud" and self.step%3!=0:
            i=(self.step//3)%4
            account=self.fraud_accounts[i]
            return {"id":"TX-"+uuid.uuid4().hex[:10].upper(),"account_id":account,
                    "device_id":"DEV-FRAUD-01","merchant":self.merchants[i%len(self.merchants)],
                    "amount":round(random.uniform(1500,3100),2),"location":"Bhopal",
                    "ip":"10.99.44.77","timestamp":now}
        if scenario=="account_takeover":
            return {"id":"TX-"+uuid.uuid4().hex[:10].upper(),"account_id":random.choice(self.accounts),
                    "device_id":"DEV-UNKNOWN","merchant":random.choice(self.merchants),
                    "amount":round(random.uniform(7000,18000),2),"location":"Mumbai",
                    "ip":"10.88.77.21","timestamp":now}
        if scenario=="rapid_transactions":
            tx=self.normal_transaction(now); tx["amount"]=round(random.uniform(2000,5000),2); return tx
        if scenario=="geographic_anomaly":
            tx=self.normal_transaction(now); tx["location"]="Mumbai"; tx["device_id"]="DEV-NEW"; return tx
        return self.normal_transaction(now)

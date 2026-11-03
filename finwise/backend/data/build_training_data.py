"""Generates data/training_data.csv — the categorizer's seed corpus.

Kept as a script rather than a hand-edited CSV so the label set stays balanced
and additions are reviewable as a diff of phrases rather than of rows.

Writing guidance for anyone extending this:
  * Use descriptions a real Indian user would actually type, including the
    sloppy ones — "swiggy", "SWIGGY ORDER", "swiggy food order 2 items".
  * Vary surface form: brand alone, brand + noun, bare noun, UPI-style strings.
    The classifier uses character n-grams too, so misspellings and casing
    variants genuinely help.
  * Do NOT add a phrase that honestly belongs to two categories (e.g. "Amazon"
    could be Shopping or Entertainment). Ambiguous input should land in the
    low-confidence path and be shown to the user, not be forced into a label.
"""
import csv
from pathlib import Path

SAMPLES: dict[str, list[str]] = {
    "Food": [
        "swiggy", "swiggy order", "Swiggy food order", "swiggy instamart groceries",
        "zomato", "zomato order", "Zomato dinner", "zomato gold renewal",
        "dominos pizza", "pizza hut", "mcdonalds", "burger king", "kfc chicken bucket",
        "subway sandwich", "starbucks coffee", "cafe coffee day", "chai point",
        "third wave coffee", "blue tokai", "canteen lunch", "college canteen",
        "mess bill", "hostel mess fee", "tiffin service", "lunch at office",
        "dinner with friends", "breakfast", "street food", "chaat", "biryani",
        "paratha", "dosa", "restaurant bill", "food court", "big basket groceries",
        "bigbasket", "blinkit", "zepto grocery", "dunzo grocery", "grofers",
        "milk delivery", "amul milk", "vegetables from market", "sabzi mandi",
        "kirana store", "grocery shopping", "d mart groceries", "reliance fresh",
        "more supermarket", "eggs and bread", "fruits", "snacks", "bakery",
        "ice cream", "juice shop", "water can delivery", "eatfit", "faasos",
        "behrouz biryani", "ovenstory", "haldiram", "bikanervala", "barbeque nation",
    ],
    "Shopping": [
        "amazon order", "amazon shopping", "flipkart order", "flipkart",
        "myntra", "myntra clothing", "ajio", "nykaa", "nykaa fashion",
        "meesho", "snapdeal", "tata cliq", "shoes", "sneakers", "nike shoes",
        "adidas", "puma tshirt", "t shirt", "jeans", "shirt purchase",
        "kurta", "saree", "clothes shopping", "zara", "h and m", "uniqlo",
        "westside", "lifestyle store", "shoppers stop", "pantaloons", "max fashion",
        "decathlon", "watch purchase", "sunglasses", "backpack", "handbag",
        "wallet", "perfume", "cosmetics", "makeup", "skincare products",
        "electronics purchase", "headphones", "earphones", "boat earbuds",
        "mobile phone", "phone case", "charger", "laptop bag", "mouse keyboard",
        "home decor", "bedsheet", "kitchen utensils", "furniture", "ikea",
        "croma electronics", "reliance digital", "vijay sales", "diwali shopping",
        "gift for friend", "birthday gift",
    ],
    "Transportation": [
        "uber", "uber ride", "uber to campus", "ola", "ola cab", "ola auto",
        "rapido", "rapido bike", "auto rickshaw", "auto fare", "taxi fare",
        "cab to airport", "metro card recharge", "metro recharge", "delhi metro",
        "namma metro", "bus ticket", "bmtc bus pass", "bus pass", "local train",
        "train ticket", "irctc booking", "irctc", "railway ticket", "tatkal booking",
        "flight ticket", "indigo flight", "air india", "spicejet", "vistara",
        "makemytrip flight", "goibibo", "petrol", "petrol fill", "fuel",
        "diesel", "hp petrol pump", "indian oil", "bharat petroleum",
        "fastag recharge", "toll charges", "parking fee", "parking",
        "bike service", "car service", "bike repair", "puncture repair",
        "vehicle insurance", "driving licence fee", "scooter rental", "bounce rental",
        "yulu bike", "zoomcar", "car wash", "engine oil change",
    ],
    "Education": [
        "college fee", "college fees", "semester fee", "tuition fee",
        "school fee", "exam fee", "examination fees", "admission fee",
        "hostel fee", "library fee", "course fee", "coursera subscription",
        "udemy course", "udemy", "byjus subscription", "unacademy",
        "vedantu classes", "khan academy donation", "coaching class fee",
        "tuition classes", "upsc coaching", "gate coaching", "ielts exam fee",
        "gre registration", "textbook", "textbooks", "reference book",
        "notebook purchase", "stationery", "stationary shop", "pens and notebooks",
        "lab manual", "project materials", "printout charges", "xerox",
        "photocopy", "thesis printing", "online certification", "nptel course",
        "edx course", "linkedin learning", "skillshare", "workshop registration",
        "seminar fee", "conference registration", "study material",
        "question bank", "mock test series", "tutor payment", "laptop for college",
    ],
    "Entertainment": [
        "netflix", "netflix subscription", "prime video", "amazon prime subscription",
        "hotstar", "disney hotstar", "jiocinema", "sony liv", "zee5",
        "spotify", "spotify premium", "youtube premium", "apple music",
        "gaana subscription", "wynk music", "movie ticket", "movie tickets",
        "bookmyshow", "pvr cinemas", "inox movie", "cinepolis",
        "concert ticket", "music concert", "stand up comedy show", "theatre play",
        "gaming", "steam game purchase", "playstation game", "xbox game pass",
        "mobile game recharge", "bgmi uc", "free fire diamonds", "google play recharge",
        "amusement park", "water park", "wonderla", "bowling", "arcade games",
        "club entry", "party", "night out", "pub bill", "beer",
        "picnic", "weekend trip", "zoo entry", "museum ticket", "exhibition",
        "sports match ticket", "ipl ticket",
    ],
    "Healthcare": [
        "apollo pharmacy", "apollo", "medplus", "pharmeasy", "1mg order",
        "netmeds", "wellness forever", "medicine", "medicines", "tablets",
        "doctor consultation", "doctor visit", "clinic visit", "opd charges",
        "hospital bill", "apollo hospital", "fortis hospital", "manipal hospital",
        "blood test", "lab test", "pathology test", "thyrocare", "dr lal pathlabs",
        "x ray", "mri scan", "ct scan", "ultrasound", "ecg test",
        "dental checkup", "dentist", "tooth filling", "root canal",
        "eye checkup", "spectacles", "lenskart", "contact lenses", "eye drops",
        "physiotherapy", "vaccination", "covid vaccine", "health checkup package",
        "health insurance premium", "mediclaim premium", "star health insurance",
        "gym membership", "cult fit", "cultfit subscription", "yoga classes",
        "protein powder", "vitamins", "supplements", "first aid",
    ],
    "Housing": [
        "rent", "house rent", "monthly rent", "flat rent", "room rent",
        "pg rent", "paying guest rent", "hostel rent", "rent payment to landlord",
        "security deposit", "maintenance charges", "society maintenance",
        "apartment maintenance", "home loan emi", "housing loan emi",
        "property tax", "house tax", "brokerage fee", "broker commission",
        "packers and movers", "shifting charges", "house shifting",
        "home repair", "plumber", "plumbing work", "electrician charges",
        "carpenter", "painting work", "house painting", "pest control",
        "deep cleaning service", "urban company cleaning", "maid salary",
        "house help salary", "cook salary", "watchman charges", "security charges",
        "furniture for home", "mattress", "curtains", "water tank cleaning",
        "lift maintenance", "generator charges", "club house fee",
    ],
    "Utilities": [
        "electricity bill", "current bill", "power bill", "bescom bill",
        "mseb bill", "tneb electricity", "adani electricity", "tata power bill",
        "water bill", "gas bill", "gas cylinder", "lpg cylinder booking",
        "indane gas", "hp gas", "bharat gas", "piped gas bill",
        "mobile recharge", "jio recharge", "airtel recharge", "vi recharge",
        "vodafone recharge", "bsnl recharge", "prepaid recharge", "postpaid bill",
        "mobile bill", "phone bill", "broadband bill", "wifi bill",
        "jio fiber", "airtel xstream", "act fibernet", "hathway broadband",
        "internet bill", "dth recharge", "tata sky recharge", "dish tv",
        "cable tv bill", "landline bill", "sewage charges", "municipal tax",
        "google one storage", "icloud storage", "cloud subscription",
    ],
    "Investments": [
        "sip", "sip investment", "mutual fund sip", "mutual fund investment",
        "groww investment", "groww", "zerodha", "zerodha funds added",
        "upstox", "angel one", "icici direct", "kuvera investment",
        "stock purchase", "shares bought", "equity investment", "nifty etf",
        "index fund", "elss investment", "ppf deposit", "ppf contribution",
        "nps contribution", "national pension scheme", "epf contribution",
        "fixed deposit", "fd booking", "recurring deposit", "rd installment",
        "gold investment", "digital gold", "sovereign gold bond", "gold etf",
        "lic premium", "life insurance premium", "term insurance premium",
        "sukanya samriddhi", "post office savings", "bond purchase",
        "crypto purchase", "bitcoin buy", "wazirx", "coindcx",
        "savings transfer", "transfer to savings", "emergency fund deposit",
    ],
    "Salary": [
        "salary", "salary credited", "monthly salary", "salary credit",
        "net salary", "pay credited", "payroll credit", "salary from company",
        "stipend", "internship stipend", "monthly stipend", "intern salary",
        "freelance payment", "freelance income", "client payment received",
        "project payment", "consulting fee received", "part time job payment",
        "bonus", "annual bonus", "performance bonus", "diwali bonus",
        "incentive received", "overtime pay", "arrears credited",
        "pocket money", "allowance from parents", "monthly allowance",
        "money from dad", "money from mom", "scholarship", "scholarship credited",
        "stipend credit", "reimbursement received", "expense reimbursement",
        "tds refund", "income tax refund", "cashback received", "interest credited",
        "fd interest", "savings account interest", "dividend received",
        "rent received", "tuition income", "side income",
    ],
    "Other": [
        "atm withdrawal", "cash withdrawal", "cash deposit", "upi transfer",
        "money sent to friend", "transfer to friend", "paid back loan",
        "borrowed money", "lent money", "split bill settlement", "splitwise settle",
        "donation", "charity donation", "temple donation", "ngo donation",
        "gift money", "wedding gift", "shagun", "festival expense",
        "bank charges", "atm charges", "service charge", "late payment fee",
        "penalty", "fine paid", "credit card bill payment", "credit card payment",
        "loan emi", "personal loan emi", "miscellaneous", "misc expense",
        "unknown transaction", "pending verification", "courier charges",
        "post office charges", "document attestation", "passport fee",
        "visa fee", "notary charges", "legal fee", "tax payment",
        "gst payment", "subscription unknown", "haircut", "salon",
        "barber shop", "laundry", "dry cleaning", "ironing charges",
        "tailor charges", "mobile repair", "laptop repair", "pet food",
        "veterinary", "photography", "printing charges",
    ],
}


def main() -> None:
    out = Path(__file__).with_name("training_data.csv")
    rows = [(text, label) for label, texts in SAMPLES.items() for text in texts]

    duplicates = {t for t, _ in rows if [x for x, _ in rows].count(t) > 1}
    if duplicates:
        raise SystemExit(f"Duplicate phrases across labels: {sorted(duplicates)}")

    with out.open("w", newline="", encoding="utf-8") as fh:
        writer = csv.writer(fh)
        writer.writerow(["description", "category"])
        writer.writerows(rows)

    print(f"wrote {out} - {len(rows)} rows")
    for label, texts in sorted(SAMPLES.items()):
        print(f"  {label:<16} {len(texts)}")


if __name__ == "__main__":
    main()

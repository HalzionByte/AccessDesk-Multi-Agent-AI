CUSTOMER_CLAIMS = {
    "uid": "demo-customer-1",
    "name": "Ayesha Khan",
    "email": "ayesha@demo.accessdesk.app",
    "role": "customer",
    "preferredLanguage": "roman-urdu",
}

STAFF_CLAIMS = {
    "uid": "demo-staff-1",
    "name": "Omar Siddiqui",
    "email": "staff@demo.accessdesk.app",
    "role": "staff",
    "preferredLanguage": "en",
}

OTHER_CUSTOMER_CLAIMS = {
    "uid": "demo-customer-2",
    "name": "Daniel Lee",
    "email": "daniel@demo.accessdesk.app",
    "role": "customer",
    "preferredLanguage": "en",
}


def auth_header(token: str) -> dict[str, str]:
    return {"Authorization": f"Bearer {token}"}

def test_health_is_public(client):
    response = client.get("/health")

    assert response.status_code == 200
    assert response.json() == {"status": "ok", "service": "AccessDesk API"}


def test_cors_allows_configured_frontend(client):
    response = client.options(
        "/health",
        headers={
            "Origin": "http://localhost:5173",
            "Access-Control-Request-Method": "GET",
        },
    )

    assert response.status_code == 200
    assert response.headers["access-control-allow-origin"] == "http://localhost:5173"


def test_unknown_route_uses_standard_error_shape(client):
    response = client.get("/does-not-exist")

    assert response.status_code == 404
    assert response.json() == {"code": "http_error", "message": "Not Found"}

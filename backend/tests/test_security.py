from app.security import hash_password, verify_password


def test_password_hash_verifies_only_correct_password() -> None:
    encoded = hash_password("a-long-test-password-123")

    assert verify_password("a-long-test-password-123", encoded)
    assert not verify_password("incorrect-password", encoded)

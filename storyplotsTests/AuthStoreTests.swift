import Testing
@testable import storyplots

@MainActor
struct AuthStoreTests {

    private func makeStore() -> AuthStore {
        // SupabaseManager falls back to an unreachable client when the test bundle
        // doesn't carry the Info.plist keys, which is fine — these tests verify
        // state mutations that short-circuit before any network call.
        AuthStore(client: SupabaseManager.shared.client)
    }

    @Test("AuthStore starts signed-out with no error and no email")
    func initialState() {
        let store = makeStore()
        #expect(store.isSignedIn == false)
        #expect(store.userEmail == nil)
        #expect(store.lastError == nil)
        #expect(store.isLoading == false)
    }

    @Test("signInEmail with empty email surfaces missingCredentials and does not flip isSignedIn")
    func emptyEmailMissingCredentials() async {
        let store = makeStore()
        await store.signInEmail("", password: "anything")
        #expect(store.lastError == .missingCredentials)
        #expect(store.isSignedIn == false)
    }

    @Test("signInEmail with empty password surfaces missingCredentials")
    func emptyPasswordMissingCredentials() async {
        let store = makeStore()
        await store.signInEmail("user@example.com", password: "")
        #expect(store.lastError == .missingCredentials)
        #expect(store.isSignedIn == false)
    }

    @Test("signUp with empty fields surfaces missingCredentials")
    func signUpMissingCredentials() async {
        let store = makeStore()
        await store.signUp(email: "", password: "")
        #expect(store.lastError == .missingCredentials)
    }

    @Test("resetPassword with empty email surfaces missingCredentials")
    func resetPasswordMissingCredentials() async {
        let store = makeStore()
        await store.resetPassword(email: "")
        #expect(store.lastError == .missingCredentials)
    }

    @Test("AuthError.userFacingMessage maps every case")
    func authErrorMessages() {
        #expect(AuthError.missingCredentials.userFacingMessage == "Enter your email and password.")
        #expect(AuthError.signInFailed("bad creds").userFacingMessage == "bad creds")
        #expect(AuthError.notImplemented.userFacingMessage == "Not implemented yet.")
    }
}

import Testing
@testable import storyplots

struct AuthStoreTests {

    @Test("Phase 0 AuthStore.signInEmail throws .notImplemented")
    func signInEmailStub() async {
        let store = AuthStore()
        do {
            try await store.signInEmail("a@b.com", password: "x")
            Issue.record("Expected AuthError.notImplemented to be thrown")
        } catch let error as AuthError {
            #expect(error == .notImplemented)
        } catch {
            Issue.record("Unexpected error type: \(error)")
        }
    }

    @Test("AuthState starts signed-out with no error")
    @MainActor
    func authStateInitial() {
        let state = AuthState()
        #expect(state.isSignedIn == false)
        #expect(state.lastError == nil)
    }

    @Test("AuthState.setSignedIn flips the flag")
    @MainActor
    func authStateFlip() {
        let state = AuthState()
        state.setSignedIn(true)
        #expect(state.isSignedIn == true)
    }
}

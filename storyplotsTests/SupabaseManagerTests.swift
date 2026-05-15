import Testing
@testable import storyplots

struct SupabaseManagerTests {

    @Test("StubSupabaseManager instantiates with isConfigured == false")
    func stubInstantiates() {
        let manager = StubSupabaseManager()
        #expect(manager.isConfigured == false)
    }
}

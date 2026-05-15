import Testing
import SwiftUI
@testable import storyplots

struct ThemeTests {

    @Test("Surface bg matches design.md §3.1")
    func bgHexMatchesSeed() {
        #expect(Theme.Color.bg == Color(hex: 0x0F0F10))
    }

    @Test("Brand1 matches design.md §3.4")
    func brand1HexMatchesSeed() {
        #expect(Theme.Color.brand1 == Color(hex: 0xF5B547))
    }

    @Test("Brand2 matches design.md §3.4")
    func brand2HexMatchesSeed() {
        #expect(Theme.Color.brand2 == Color(hex: 0xFF7B3D))
    }

    @Test("Spacing scale is monotonic with the seed values")
    func spacingMonotonic() {
        #expect(Theme.Spacing.s0 == 0)
        #expect(Theme.Spacing.s1 == 4)
        #expect(Theme.Spacing.s2 == 8)
        #expect(Theme.Spacing.s4 == 16)
        #expect(Theme.Spacing.s6 == 24)
        #expect(Theme.Spacing.s12 == 48)
        #expect(Theme.Spacing.s1 < Theme.Spacing.s2)
        #expect(Theme.Spacing.s8 > Theme.Spacing.s6)
    }

    @Test("Radius card == 14, sheet == 20")
    func radiusValues() {
        #expect(Theme.Radius.card == 14)
        #expect(Theme.Radius.sheet == 20)
    }

    @Test("All 16 accent presets are present in the AccentPreset.all list")
    func sixteenAccentPresets() {
        #expect(Theme.Color.AccentPreset.all.count == 16)
    }

    @Test("Motion durations match the seed tokens")
    func motionDurations() {
        #expect(Theme.Motion.fast == 0.12)
        #expect(Theme.Motion.base == 0.20)
        #expect(Theme.Motion.slow == 0.32)
    }

    @Test("Shadow presets resolve via Theme.Shadow.preset(_:)")
    func shadowPresets() {
        let sm = Theme.Shadow.preset(.sm)
        let md = Theme.Shadow.preset(.md)
        let lg = Theme.Shadow.preset(.lg)
        #expect(sm.radius == 1)
        #expect(md.radius == 12)
        #expect(lg.radius == 40)
        #expect(lg.y > md.y)
        #expect(md.y > sm.y)
    }
}

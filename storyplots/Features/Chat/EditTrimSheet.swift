import SwiftUI

/// Sheet for "edit as trim" — replaces a message's text and deletes
/// everything that came after it in the conversation. Used from the
/// message context menu.
struct EditTrimSheet: View {
    let originalText: String
    let onSave: (String) -> Void

    @State private var draft: String = ""
    @State private var didInit: Bool = false
    @Environment(\.dismiss) private var dismiss

    var body: some View {
        NavigationStack {
            VStack(spacing: 0) {
                HStack(spacing: Theme.Spacing.s2) {
                    Image(systemName: "exclamationmark.triangle.fill")
                        .foregroundStyle(Theme.Color.warning)
                    Text("Saving will delete every message after this one.")
                        .font(Theme.FontStyle.timestamp)
                        .foregroundStyle(Theme.Color.warning)
                }
                .frame(maxWidth: .infinity, alignment: .leading)
                .padding(Theme.Spacing.s3)
                .background(Theme.Color.warningSoft)

                TextEditor(text: $draft)
                    .padding(Theme.Spacing.s3)
                    .background(Theme.Color.bg)
            }
            .navigationTitle("Edit message")
            .navigationBarTitleDisplayMode(.inline)
            .toolbar {
                ToolbarItem(placement: .cancellationAction) {
                    Button("Cancel") { dismiss() }
                }
                ToolbarItem(placement: .confirmationAction) {
                    Button("Save & trim") {
                        Haptics.notify(.warning)
                        onSave(draft)
                        dismiss()
                    }
                    .disabled(draft.trimmingCharacters(in: .whitespacesAndNewlines).isEmpty || draft == originalText)
                }
            }
            .onAppear {
                if !didInit {
                    draft = originalText
                    didInit = true
                }
            }
        }
        .presentationDetents([.medium, .large])
    }
}

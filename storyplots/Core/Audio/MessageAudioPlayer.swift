import AVFoundation
import Foundation
import OSLog

private let audioLog = Logger(subsystem: "com.storyplots.ios", category: "audio")

/// Single-track player wrapper for message TTS playback. Only one message
/// can play at a time — playing a new one stops the previous track.
///
/// Uses `AVPlayer` over `AVAudioPlayer` so we accept whatever container the
/// backend returns (mp3 / mpga / mp4 / m4a / wav / ogg/opus via the system
/// decoder when available). For Opus the bytes go through `AVURLAsset` from
/// a temp file path; AVAudioPlayer rejected those with `kAudioFileUnsupportedFileTypeError`.
@MainActor
final class MessageAudioPlayer: NSObject {
    private var player: AVPlayer?
    private var observer: NSObjectProtocol?
    private var tempFileURL: URL?
    private(set) var currentMessageID: String?
    var onFinish: (@MainActor (String) -> Void)?

    /// Configures AVAudioSession for `.playback` so audio plays even when the
    /// device is in silent mode (this matches the seed §3.8 ux for TTS).
    func activateSession() {
        #if os(iOS)
        do {
            try AVAudioSession.sharedInstance().setCategory(.playback, mode: .spokenAudio)
            try AVAudioSession.sharedInstance().setActive(true)
        } catch {
            audioLog.error("activate session: \(error.localizedDescription, privacy: .public)")
        }
        #endif
    }

    func deactivateSession() {
        #if os(iOS)
        try? AVAudioSession.sharedInstance().setActive(false, options: .notifyOthersOnDeactivation)
        #endif
    }

    /// Plays `data` for the given message id. Writes the bytes to a temp file
    /// and creates an AVPlayer item from it — AVPlayer probes content type
    /// from the data, not just the file extension.
    func play(_ data: Data, for messageID: String, contentType: String?) throws {
        activateSession()

        let ext = inferExtension(from: contentType)
        let url = FileManager.default.temporaryDirectory
            .appendingPathComponent("storyplots-tts-\(messageID).\(ext)")
        try data.write(to: url, options: .atomic)
        audioLog.info("audio temp file bytes=\(data.count) ext=\(ext, privacy: .public)")

        stop() // tear down previous player + temp file

        let asset = AVURLAsset(url: url)
        let item = AVPlayerItem(asset: asset)
        let newPlayer = AVPlayer(playerItem: item)
        newPlayer.actionAtItemEnd = .pause

        observer = NotificationCenter.default.addObserver(
            forName: .AVPlayerItemDidPlayToEndTime,
            object: item,
            queue: .main
        ) { [weak self] _ in
            Task { @MainActor in
                guard let self else { return }
                if let id = self.currentMessageID {
                    self.onFinish?(id)
                }
                self.stop()
            }
        }

        player = newPlayer
        tempFileURL = url
        currentMessageID = messageID
        newPlayer.play()
    }

    func pause() {
        player?.pause()
    }

    func resume() {
        player?.play()
    }

    func stop() {
        if let observer {
            NotificationCenter.default.removeObserver(observer)
        }
        observer = nil
        player?.pause()
        player = nil
        currentMessageID = nil
        if let temp = tempFileURL {
            try? FileManager.default.removeItem(at: temp)
        }
        tempFileURL = nil
    }

    var isPlaying: Bool {
        guard let p = player else { return false }
        return p.timeControlStatus == .playing
    }

    private func inferExtension(from contentType: String?) -> String {
        guard let ct = contentType?.lowercased() else { return "mp3" }
        if ct.contains("opus") { return "opus" }
        if ct.contains("ogg") { return "ogg" }
        if ct.contains("mpeg") || ct.contains("mp3") { return "mp3" }
        if ct.contains("mp4") || ct.contains("m4a") || ct.contains("aac") { return "m4a" }
        if ct.contains("wav") { return "wav" }
        return "mp3"
    }
}

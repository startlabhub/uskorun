// USKORUN-owned native disk queue. MIT, see LICENSE.
// On-disk schema v1: metadata JSON + fsynced newline-delimited JSON fixes.
// Every OS fix is durable before the WebView is asked to drain it.
import Foundation

struct USKRun: Codable {
    let clientId: String
    let activityId: String
    let kind: String
    var segment: Int
    var active: Bool
}
struct USKFix: Codable {
    let seq: Int
    let clientId: String
    let activityId: String
    let segment: Int
    let lat: Double
    let lon: Double
    let accuracy: Double
    let t: Double

    var dictionary: [String: Any] {
        ["seq": seq, "clientId": clientId, "activityId": activityId,
         "segment": segment, "lat": lat, "lon": lon, "accuracy": accuracy, "t": t]
    }
}
private struct USKMeta: Codable {
    var version = 1
    var run: USKRun?
    var ackThrough = 0
    var lastSeq = 0
    var overflow = false
}

enum USKStoreError: LocalizedError {
    case invalid(String)
    var errorDescription: String? {
        switch self { case .invalid(let message): return message }
    }
}

final class USKDiskQueue {
    static let shared = USKDiskQueue()
    private let maxRecords = 10000
    private let directory: URL
    private let metadataURL: URL
    private let fixesURL: URL
    private var meta = USKMeta()

    private init() {
        // All public methods are called on the main queue (CLLocation delegate).
        let base = FileManager.default.urls(for: .applicationSupportDirectory, in: .userDomainMask)[0]
        // Keep the GPS log writable while the screen is locked. Apple
        // .completeUntilFirstUserAuthentication unlocks at first device unlock
        // and stays available on later locks. .complete blocks locked writes;
        // .completeUnlessOpen is unsuitable for this per-fix open/close log.
        // After a reboot, recording cannot access this log before first unlock.
        directory = base.appendingPathComponent("USKORUNNativeGPS", isDirectory: true)
        metadataURL = directory.appendingPathComponent("state-v1.json")
        fixesURL = directory.appendingPathComponent("fixes-v1.jsonl")
        do {
            try FileManager.default.createDirectory(at: directory, withIntermediateDirectories: true)
            // Explicit directory protection, including freshly-created files.
            try FileManager.default.setAttributes([.protectionKey:
                FileProtectionType.completeUntilFirstUserAuthentication], ofItemAtPath: directory.path)
            var attr = URLResourceValues()
            attr.isExcludedFromBackup = true
            var url = directory
            try? url.setResourceValues(attr)
            if FileManager.default.fileExists(atPath: metadataURL.path) {
                meta = try JSONDecoder().decode(USKMeta.self, from: Data(contentsOf: metadataURL))
                guard meta.version == 1 else { throw USKStoreError.invalid("Queue schema mismatch") }
            }
            // A crash after a data fsync but before metadata write must not
            // reuse a seq. Recover the greatest persisted seq on startup.
            let all = try readAll()
            meta.lastSeq = max(meta.lastSeq, all.last?.seq ?? 0)
            try persistMeta()
        } catch {
            // Fail-closed: don't overwrite corrupted user location on restart.
            startupError = String(describing: error)
        }
    }
    private(set) var startupError: String?
    var current: USKRun? { meta.run }
    var isActive: Bool { meta.run?.active == true }
    private func requireHealthy() throws {
        if let error = startupError { throw USKStoreError.invalid("Native queue unavailable: " + error) }
    }
    private func persistMeta() throws {
        let encoded = try JSONEncoder().encode(meta)
        try encoded.write(to: metadataURL, options: .atomic)
        try FileManager.default.setAttributes([.protectionKey:
            FileProtectionType.completeUntilFirstUserAuthentication], ofItemAtPath: metadataURL.path)
    }
    private func readAll() throws -> [USKFix] {
        if !FileManager.default.fileExists(atPath: fixesURL.path) { return [] }
        let data = try Data(contentsOf: fixesURL)
        guard data.isEmpty || data.last == 10 else {
            throw USKStoreError.invalid("Incomplete native GPS log tail; do not discard")
        }
        let string = String(data: data, encoding: .utf8)
        guard let string else { throw USKStoreError.invalid("Invalid GPS log encoding") }
        var output: [USKFix] = []
        for line in string.split(separator: "\n") {
            guard let data = String(line).data(using: .utf8) else {
                throw USKStoreError.invalid("Invalid queued fix encoding")
            }
            let fix = try JSONDecoder().decode(USKFix.self, from: data)
            if let last = output.last, fix.seq != last.seq + 1 {
                throw USKStoreError.invalid("Native GPS sequence gap/corruption")
            }
            output.append(fix)
        }
        return output
    }
    func begin(clientId: String, activityId: String, kind: String, segment: Int) throws {
        try requireHealthy()
        guard !clientId.isEmpty, !activityId.isEmpty,
              (kind == "run" || kind == "walk"), segment >= 0, segment <= 10000 else {
            throw USKStoreError.invalid("Invalid native run contract")
        }
        if let run = meta.run {
            guard run.clientId == clientId && run.activityId == activityId && run.kind == kind else {
                throw USKStoreError.invalid("Previous native session has not been reset")
            }
            guard segment >= run.segment else { throw USKStoreError.invalid("Old GPS segment") }
        } else {
            // Old records can never cross into a new session.
            guard try readAll().allSatisfy({ $0.seq <= meta.ackThrough }) else {
                throw USKStoreError.invalid("Unacknowledged GPS points from previous session")
            }
        }
        meta.run = USKRun(clientId: clientId, activityId: activityId, kind: kind, segment: segment, active: true)
        try persistMeta()
    }
    func pause() throws {
        try requireHealthy()
        meta.run?.active = false
        try persistMeta()
    }
    func append(lat: Double, lon: Double, accuracy: Double, t: Double) throws {
        try requireHealthy()
        guard let run = meta.run, run.active else { return }
        guard [lat,lon,accuracy,t].allSatisfy({ $0.isFinite }),
              abs(lat) <= 90, abs(lon) <= 180,
              accuracy >= 0, accuracy <= 50, t > 0 else { return }
        let backlog = meta.lastSeq - meta.ackThrough
        if backlog >= maxRecords {
            meta.overflow = true
            try persistMeta()
            throw USKStoreError.invalid("Native GPS queue is full; Finish or Abandon")
        }
        let fix = USKFix(seq: meta.lastSeq + 1,
            clientId: run.clientId, activityId: run.activityId, segment: run.segment,
            lat: lat, lon: lon, accuracy: accuracy, t: t)
        let line = try JSONEncoder().encode(fix) + Data([10])
        if !FileManager.default.fileExists(atPath: fixesURL.path) {
            FileManager.default.createFile(atPath: fixesURL.path, contents: nil)
            try FileManager.default.setAttributes([.protectionKey:
                FileProtectionType.completeUntilFirstUserAuthentication], ofItemAtPath: fixesURL.path)
        }
        let file = try FileHandle(forWritingTo: fixesURL)
        defer { file.closeFile() }
        file.seekToEndOfFile()
        file.write(line)
        file.synchronizeFile() // fsync before reporting the fix to WebView
        meta.lastSeq = fix.seq
        try persistMeta()
    }
    func drain(limit: Int) throws -> ([USKFix], Bool, Bool) {
        try requireHealthy()
        guard limit > 0 && limit <= 500 else { throw USKStoreError.invalid("Drain limit must be 1...500") }
        let all = try readAll()
        return (Array(all.filter { $0.seq > meta.ackThrough }.prefix(limit)), isActive, meta.overflow)
    }
    func ack(clientId: String, activityId: String, seqs: [Int]) throws -> Int {
        try requireHealthy()
        guard let run = meta.run, run.clientId == clientId, run.activityId == activityId else {
            throw USKStoreError.invalid("ACK session mismatch")
        }
        let pending = try readAll().filter { $0.seq > meta.ackThrough }
        let confirmed = Array(pending.prefix(seqs.count)).map(\.seq)
        guard seqs == confirmed else { throw USKStoreError.invalid("ACK must be a contiguous drained prefix") }
        guard let last = seqs.last else { return 0 }
        meta.ackThrough = last
        try persistMeta()
        return seqs.count
    }
    func reset(clientId: String, activityId: String) throws {
        try requireHealthy()
        guard let run = meta.run, run.clientId == clientId, run.activityId == activityId else {
            throw USKStoreError.invalid("Reset session mismatch")
        }
        guard !run.active else { throw USKStoreError.invalid("Stop native tracking before reset") }
        guard try readAll().allSatisfy({ $0.seq <= meta.ackThrough }) else {
            throw USKStoreError.invalid("Unacknowledged location points; cannot reset")
        }
        // Keep sequence monotonic until explicit clear, and remove old raw route.
        let oldMeta = meta
        meta = USKMeta()
        do {
            try Data().write(to: fixesURL, options: .atomic)
            // Atomic replacement creates a new inode: reapply protection.
            try FileManager.default.setAttributes([.protectionKey:
                FileProtectionType.completeUntilFirstUserAuthentication], ofItemAtPath: fixesURL.path)
            try persistMeta()
        } catch {
            meta = oldMeta
            throw error
        }
    }
}

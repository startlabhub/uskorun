// USKORUN-owned background Core Location recorder. MIT, see LICENSE.
// Only stores OS CLLocation observations. No synthetic distance or points.
import Foundation
import CoreLocation
import UIKit

final class USKLocationRecorder: NSObject, CLLocationManagerDelegate {
    static let shared = USKLocationRecorder()
    private let manager = CLLocationManager()
    private let queue = USKDiskQueue.shared
    private(set) var lastError: String?

    private override init() {
        super.init()
        manager.delegate = self
        manager.activityType = .fitness
        manager.desiredAccuracy = kCLLocationAccuracyBest
        manager.distanceFilter = kCLDistanceFilterNone
        manager.pausesLocationUpdatesAutomatically = false
        manager.showsBackgroundLocationIndicator = true
    }

    func begin(clientId: String, activityId: String, kind: String, segment: Int) throws {
        guard CLLocationManager.locationServicesEnabled() else {
            throw USKStoreError.invalid("Enable iOS Location Services before recording")
        }
        let status = manager.authorizationStatus
        if status == .notDetermined {
            manager.requestWhenInUseAuthorization()
            throw USKStoreError.invalid("Grant location permission, then tap Start/Resume again")
        }
        if status == .authorizedWhenInUse {
            manager.requestAlwaysAuthorization()
            throw USKStoreError.invalid("Background recording requires Always location permission; retry after granting")
        }
        guard status == .authorizedAlways else {
            throw USKStoreError.invalid("Always location permission is denied or restricted")
        }
        try queue.begin(clientId: clientId, activityId: activityId, kind: kind, segment: segment)
        startOSLocation()
    }
    private func startOSLocation() {
        manager.allowsBackgroundLocationUpdates = true
        manager.startUpdatingLocation()
        // Optional coarse wake mechanism. NOT dense recording after kill:
        // wakes can occur at ~500m and >=5min intervals if iOS permits.
        if CLLocationManager.significantLocationChangeMonitoringAvailable() {
            manager.startMonitoringSignificantLocationChanges()
        }
    }
    func pause() throws {
        // Persist inactive state BEFORE telling the OS to stop.
        try queue.pause()
        manager.stopUpdatingLocation()
        manager.stopMonitoringSignificantLocationChanges()
    }
    func end() throws { try pause() }
    func drain(limit: Int) throws -> ([USKFix], Bool, Bool) {
        try queue.drain(limit: limit)
    }
    func ack(clientId: String, activityId: String, seqs: [Int]) throws -> Int {
        try queue.ack(clientId: clientId, activityId: activityId, seqs: seqs)
    }
    func reset(clientId: String, activityId: String) throws {
        try queue.reset(clientId: clientId, activityId: activityId)
    }
    func restoreAfterLaunch(options: [UIApplication.LaunchOptionsKey: Any]?) {
        // Called by AppDelegate before the Capacitor WebView is initialized.
        // If iOS relaunched us for significant change, immediately re-register.
        // Force-quit behavior is OS-controlled and NOT guaranteed.
        guard queue.isActive else { return }
        if manager.authorizationStatus == .authorizedAlways {
            startOSLocation()
        } else {
            lastError = "Saved recording cannot restart; Always location permission unavailable"
        }
    }
    func locationManager(_ manager: CLLocationManager, didUpdateLocations locations: [CLLocation]) {
        guard queue.isActive else { return }
        for position in locations {
            if #available(iOS 15.0, *) {
                if position.sourceInformation?.isSimulatedBySoftware == true { continue }
            }
            let ms = position.timestamp.timeIntervalSince1970 * 1000
            let now = Date().timeIntervalSince1970 * 1000
            guard ms > 0, ms <= now + 10000, ms >= now - 120000 else { continue }
            do {
                try queue.append(lat: position.coordinate.latitude,
                                 lon: position.coordinate.longitude,
                                 accuracy: position.horizontalAccuracy, t: ms)
            } catch {
                lastError = "Native queue write failed: " + String(describing: error)
                // Fail closed. Never keep collecting unpersisted samples.
                try? pause()
                return
            }
        }
    }
    func locationManager(_ manager: CLLocationManager, didFailWithError error: Error) {
        lastError = "Core Location: " + error.localizedDescription
        // GPS may become temporarily unavailable; this is NOT an accepted fix.
        // Keep explicit recording state until the user pauses/finishes, but do
        // not synthesize missing samples.
    }
}

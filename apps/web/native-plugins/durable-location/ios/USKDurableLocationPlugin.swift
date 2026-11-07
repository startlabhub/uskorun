// Local Capacitor 7 plugin, MIT; registration in USKBridgeViewController.swift.
import Foundation
import Capacitor

@objc(USKDurableLocationPlugin)
public class USKDurableLocationPlugin: CAPPlugin, CAPBridgedPlugin {
    public let identifier = "USKDurableLocationPlugin"
    public let jsName = "USKDurableLocation"
    public let pluginMethods: [CAPPluginMethod] = [
        CAPPluginMethod(name: "begin", returnType: CAPPluginReturnPromise),
        CAPPluginMethod(name: "pause", returnType: CAPPluginReturnPromise),
        CAPPluginMethod(name: "end", returnType: CAPPluginReturnPromise),
        CAPPluginMethod(name: "drain", returnType: CAPPluginReturnPromise),
        CAPPluginMethod(name: "ack", returnType: CAPPluginReturnPromise),
        CAPPluginMethod(name: "reset", returnType: CAPPluginReturnPromise)
    ]
    private let recorder = USKLocationRecorder.shared

    @objc func begin(_ call: CAPPluginCall) {
        DispatchQueue.main.async {
            guard let clientId = call.getString("clientId"),
                  let activityId = call.getString("activityId"),
                  let kind = call.getString("kind"),
                  let segment = call.getInt("segment") else {
                call.reject("Missing native GPS session fields"); return
            }
            do {
                try self.recorder.begin(clientId: clientId, activityId: activityId,
                                        kind: kind, segment: segment)
                call.resolve(["active": true])
            } catch { call.reject(error.localizedDescription) }
        }
    }
    @objc func pause(_ call: CAPPluginCall) {
        DispatchQueue.main.async {
            do { try self.recorder.pause(); call.resolve() }
            catch { call.reject(error.localizedDescription) }
        }
    }
    @objc func end(_ call: CAPPluginCall) {
        DispatchQueue.main.async {
            do { try self.recorder.end(); call.resolve() }
            catch { call.reject(error.localizedDescription) }
        }
    }
    @objc func drain(_ call: CAPPluginCall) {
        DispatchQueue.main.async {
            do {
                let (records, active, overflow) = try self.recorder.drain(limit: call.getInt("limit") ?? 500)
                call.resolve(["records": records.map { $0.dictionary },
                              "active": active, "overflow": overflow])
            } catch { call.reject(error.localizedDescription) }
        }
    }
    @objc func ack(_ call: CAPPluginCall) {
        DispatchQueue.main.async {
            guard let clientId = call.getString("clientId"),
                  let activityId = call.getString("activityId"),
                  let seqs = call.getArray("seqs") as? [Int] else {
                call.reject("Missing native ACK fields");return
            }
            do {
                let removed = try self.recorder.ack(clientId: clientId, activityId: activityId, seqs: seqs)
                call.resolve(["removed": removed])
            } catch { call.reject(error.localizedDescription) }
        }
    }
    @objc func reset(_ call: CAPPluginCall) {
        DispatchQueue.main.async {
            guard let clientId = call.getString("clientId"),
                  let activityId = call.getString("activityId") else {
                call.reject("Missing reset session");return
            }
            do {
                try self.recorder.reset(clientId: clientId, activityId: activityId)
                call.resolve()
            } catch { call.reject(error.localizedDescription) }
        }
    }
}

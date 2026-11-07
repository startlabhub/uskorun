// In the generated Xcode App target, replace storyboard controller class
// CAPBridgeViewController with USKBridgeViewController (App module).
import Capacitor

open class USKBridgeViewController: CAPBridgeViewController {
    override open func capacitorDidLoad() {
        super.capacitorDidLoad()
        bridge?.registerPluginInstance(USKDurableLocationPlugin())
    }
}

#!/usr/bin/env ruby
# Optional iOS Xcode App target link step (uses the xcodeproj gem installed
# by CocoaPods; if unavailable, select the 4 Swift files in Xcode and enable
# Target Membership: App manually). No cloud/build/deploy operations.
begin
  require 'xcodeproj'
rescue LoadError
  abort 'xcodeproj gem missing. In Xcode: Add Files to App target and select the four Swift source files.'
end
root=Dir.pwd
path=File.join(root,'ios','App','App.xcodeproj')
abort "Xcode project missing: #{path}" unless File.exist?(path)
project=Xcodeproj::Project.open(path)
target=project.targets.find{|t|t.name=='App'}
abort 'App Xcode target missing' unless target
appDelegate=project.files.find{|ref|ref.path&.end_with?('AppDelegate.swift')}
abort 'AppDelegate.swift Xcode reference missing' unless appDelegate
group=appDelegate.parent
owned=group.children.find{|x|x.respond_to?(:display_name)&&x.display_name=='USKDurableLocation'}
owned||=group.new_group('USKDurableLocation','USKDurableLocation')
files=%w[USKDiskQueue.swift USKLocationRecorder.swift USKDurableLocationPlugin.swift USKBridgeViewController.swift]
files.each do |name|
  file=owned.files.find{|ref|ref.path==name}||owned.new_file(name)
  unless target.source_build_phase.files_references.include?(file)
    target.source_build_phase.add_file_reference(file,true)
  end
end
project.save
puts "Linked #{files.length} Swift sources to Xcode App target. Validate with xcodebuild."

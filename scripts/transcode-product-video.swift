import AVFoundation
import AppKit
import CoreGraphics
import CoreMedia
import Foundation
import ImageIO
import QuartzCore
import UniformTypeIdentifiers

enum TranscodeError: Error {
    case missingVideoTrack
    case unableToCreateCompositionTrack
    case unableToCreateExportSession
    case unableToCreatePosterDestination
    case missingCleanFrame
}

func writePNG(_ image: CGImage, to output: URL) throws {
    try? FileManager.default.removeItem(at: output)
    guard let destination = CGImageDestinationCreateWithURL(
        output as CFURL,
        UTType.png.identifier as CFString,
        1,
        nil
    ) else {
        throw TranscodeError.unableToCreatePosterDestination
    }
    CGImageDestinationAddImage(destination, image, nil)
    guard CGImageDestinationFinalize(destination) else {
        throw TranscodeError.unableToCreatePosterDestination
    }
}

func transcode(
    source: URL,
    output: URL,
    poster: URL,
    screenshotsDirectory: URL
) async throws {
    let sourceAsset = AVURLAsset(url: source)
    let duration = try await sourceAsset.load(.duration)
    guard let sourceTrack = try await sourceAsset.loadTracks(withMediaType: .video).first else {
        throw TranscodeError.missingVideoTrack
    }

    let composition = AVMutableComposition()
    guard let compositionTrack = composition.addMutableTrack(
        withMediaType: .video,
        preferredTrackID: kCMPersistentTrackID_Invalid
    ) else {
        throw TranscodeError.unableToCreateCompositionTrack
    }
    try compositionTrack.insertTimeRange(
        CMTimeRange(start: .zero, duration: duration),
        of: sourceTrack,
        at: .zero
    )

    let sourceSize = try await sourceTrack.load(.naturalSize)
    let targetSize = CGSize(width: 720, height: 1566)
    let scale = max(
        targetSize.width / sourceSize.width,
        targetSize.height / sourceSize.height
    )
    let scaledSize = CGSize(
        width: sourceSize.width * scale,
        height: sourceSize.height * scale
    )
    let translation = CGAffineTransform(
        translationX: (targetSize.width - scaledSize.width) / 2,
        y: (targetSize.height - scaledSize.height) / 2
    )
    let sourceTransform = try await sourceTrack.load(.preferredTransform)
    let transform = sourceTransform
        .concatenating(CGAffineTransform(scaleX: scale, y: scale))
        .concatenating(translation)

    let instruction = AVMutableVideoCompositionInstruction()
    instruction.timeRange = CMTimeRange(start: .zero, duration: duration)
    let layerInstruction = AVMutableVideoCompositionLayerInstruction(
        assetTrack: compositionTrack
    )
    layerInstruction.setTransform(transform, at: .zero)
    instruction.layerInstructions = [layerInstruction]

    let videoComposition = AVMutableVideoComposition()
    videoComposition.renderSize = targetSize
    videoComposition.frameDuration = CMTime(value: 1, timescale: 30)
    videoComposition.instructions = [instruction]

    let generator = AVAssetImageGenerator(asset: sourceAsset)
    generator.appliesPreferredTrackTransform = true
    generator.requestedTimeToleranceBefore = .zero
    generator.requestedTimeToleranceAfter = .zero
    generator.maximumSize = targetSize
    let cleanFrame = try await generator.image(
        at: CMTime(seconds: 0.35, preferredTimescale: 600)
    ).image

    let parentLayer = CALayer()
    parentLayer.frame = CGRect(origin: .zero, size: targetSize)
    let videoLayer = CALayer()
    videoLayer.frame = parentLayer.frame
    let cleanFrameLayer = CALayer()
    cleanFrameLayer.frame = parentLayer.frame
    cleanFrameLayer.contents = cleanFrame
    cleanFrameLayer.contentsGravity = .resizeAspectFill
    cleanFrameLayer.opacity = 1
    let hideCleanFrame = CABasicAnimation(keyPath: "opacity")
    hideCleanFrame.fromValue = 1
    hideCleanFrame.toValue = 0
    hideCleanFrame.beginTime = AVCoreAnimationBeginTimeAtZero + 0.3
    hideCleanFrame.duration = 0.001
    hideCleanFrame.fillMode = .forwards
    hideCleanFrame.isRemovedOnCompletion = false
    cleanFrameLayer.add(hideCleanFrame, forKey: "hide-clean-home-frame")
    parentLayer.addSublayer(videoLayer)
    parentLayer.addSublayer(cleanFrameLayer)
    videoComposition.animationTool = AVVideoCompositionCoreAnimationTool(
        postProcessingAsVideoLayer: videoLayer,
        in: parentLayer
    )

    try? FileManager.default.removeItem(at: output)
    guard let exportSession = AVAssetExportSession(
        asset: composition,
        presetName: AVAssetExportPresetHighestQuality
    ) else {
        throw TranscodeError.unableToCreateExportSession
    }
    exportSession.videoComposition = videoComposition
    exportSession.shouldOptimizeForNetworkUse = true
    exportSession.fileLengthLimit = 5_900_000
    try await exportSession.export(to: output, as: .mp4)

    try writePNG(cleanFrame, to: poster)

    try FileManager.default.createDirectory(
        at: screenshotsDirectory,
        withIntermediateDirectories: true
    )
    let screenshots: [(String, Double)] = [
        ("home", 0.35),
        ("progress", 2),
        ("camera", 5),
        ("compare", 15),
        ("video", 20),
        ("share", 24.6),
    ]
    generator.maximumSize = CGSize(width: 1206, height: 2622)
    for (name, seconds) in screenshots {
        let image = try await generator.image(
            at: CMTime(seconds: seconds, preferredTimescale: 600)
        ).image
        try writePNG(
            image,
            to: screenshotsDirectory.appendingPathComponent("\(name).png")
        )
    }
}

guard CommandLine.arguments.count == 5 else {
    FileHandle.standardError.write(
        Data("Usage: swift transcode-product-video.swift input.mp4 output.mp4 poster.png screenshots-directory\n".utf8)
    )
    exit(64)
}

Task {
    do {
        try await transcode(
            source: URL(fileURLWithPath: CommandLine.arguments[1]),
            output: URL(fileURLWithPath: CommandLine.arguments[2]),
            poster: URL(fileURLWithPath: CommandLine.arguments[3]),
            screenshotsDirectory: URL(
                fileURLWithPath: CommandLine.arguments[4],
                isDirectory: true
            )
        )
        exit(0)
    } catch {
        FileHandle.standardError.write(Data("Video export failed: \(error)\n".utf8))
        exit(1)
    }
}

RunLoop.main.run()

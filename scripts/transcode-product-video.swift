import AVFoundation
import CoreGraphics
import Foundation
import ImageIO
import UniformTypeIdentifiers

enum TranscodeError: Error {
    case missingVideoTrack
    case unableToCreateCompositionTrack
    case unableToCreateExportSession
    case unableToCreatePosterDestination
}

func transcode(source: URL, output: URL, poster: URL) async throws {
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
    let targetSize = CGSize(width: 540, height: 1174)
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
    let transform = CGAffineTransform(scaleX: scale, y: scale)
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

    try? FileManager.default.removeItem(at: output)
    guard let exportSession = AVAssetExportSession(
        asset: composition,
        presetName: AVAssetExportPresetHighestQuality
    ) else {
        throw TranscodeError.unableToCreateExportSession
    }
    exportSession.videoComposition = videoComposition
    exportSession.shouldOptimizeForNetworkUse = true
    exportSession.fileLengthLimit = 3_400_000
    try await exportSession.export(to: output, as: .mp4)

    let generator = AVAssetImageGenerator(asset: sourceAsset)
    generator.appliesPreferredTrackTransform = true
    generator.maximumSize = CGSize(width: 1080, height: 2348)
    let frame = try generator.copyCGImage(
        at: CMTime(seconds: 10, preferredTimescale: 600),
        actualTime: nil
    )
    try? FileManager.default.removeItem(at: poster)
    guard let destination = CGImageDestinationCreateWithURL(
        poster as CFURL,
        UTType.png.identifier as CFString,
        1,
        nil
    ) else {
        throw TranscodeError.unableToCreatePosterDestination
    }
    CGImageDestinationAddImage(destination, frame, nil)
    guard CGImageDestinationFinalize(destination) else {
        throw TranscodeError.unableToCreatePosterDestination
    }
}

guard CommandLine.arguments.count == 4 else {
    FileHandle.standardError.write(
        Data("Usage: swift transcode-product-video.swift input.mp4 output.mp4 poster.png\n".utf8)
    )
    exit(64)
}

Task {
    do {
        try await transcode(
            source: URL(fileURLWithPath: CommandLine.arguments[1]),
            output: URL(fileURLWithPath: CommandLine.arguments[2]),
            poster: URL(fileURLWithPath: CommandLine.arguments[3])
        )
        exit(0)
    } catch {
        FileHandle.standardError.write(Data("Video export failed: \(error)\n".utf8))
        exit(1)
    }
}

RunLoop.main.run()

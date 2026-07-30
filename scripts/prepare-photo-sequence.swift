import AppKit
import AVFoundation
import CoreImage
import Foundation
import ImageIO
import UniformTypeIdentifiers
import Vision

enum SequencePreparationError: Error, CustomStringConvertible {
    case invalidArguments
    case missingImage(URL)
    case missingFaceLandmarks(URL)
    case unableToCreateImage
    case unableToCreateDestination(URL)
    case unableToCreateWriter
    case unableToCreatePixelBuffer
    case exportFailed(String)

    var description: String {
        switch self {
        case .invalidArguments:
            "Usage: swift prepare-photo-sequence.swift <source-directory> <day-1.jpg> <day-365.jpg> <loop.mp4> <poster.png>"
        case .missingImage(let url):
            "Unable to load image: \(url.path)"
        case .missingFaceLandmarks(let url):
            "Unable to detect both eyes in: \(url.lastPathComponent)"
        case .unableToCreateImage:
            "Unable to render an aligned image."
        case .unableToCreateDestination(let url):
            "Unable to create image destination: \(url.path)"
        case .unableToCreateWriter:
            "Unable to create the H.264 progress-film writer."
        case .unableToCreatePixelBuffer:
            "Unable to create a video pixel buffer."
        case .exportFailed(let message):
            "Video export failed: \(message)"
        }
    }
}

struct FacePhoto {
    let url: URL
    let image: CGImage
    let leftEye: CGPoint
    let rightEye: CGPoint
}

let ciContext = CIContext(options: [.cacheIntermediates: false])
let comparisonSize = CGSize(width: 1280, height: 1600)
let filmSize = CGSize(width: 720, height: 900)
let targetEyeCenter = CGPoint(x: 0.5, y: 0.64)
let targetEyeDistanceRatio: CGFloat = 0.24

func loadImage(at url: URL) throws -> CGImage {
    guard let source = CGImageSourceCreateWithURL(url as CFURL, nil),
          let image = CGImageSourceCreateImageAtIndex(source, 0, nil) else {
        throw SequencePreparationError.missingImage(url)
    }
    return image
}

func average(_ points: [CGPoint]) -> CGPoint? {
    guard points.isEmpty == false else { return nil }
    let total = points.reduce(CGPoint.zero) {
        CGPoint(x: $0.x + $1.x, y: $0.y + $1.y)
    }
    return CGPoint(
        x: total.x / CGFloat(points.count),
        y: total.y / CGFloat(points.count)
    )
}

func imagePoint(
    from region: VNFaceLandmarkRegion2D,
    face: VNFaceObservation,
    image: CGImage
) -> CGPoint? {
    guard let point = average(region.normalizedPoints) else { return nil }
    let faceRect = VNImageRectForNormalizedRect(
        face.boundingBox,
        image.width,
        image.height
    )
    return CGPoint(
        x: faceRect.minX + point.x * faceRect.width,
        y: faceRect.minY + point.y * faceRect.height
    )
}

func analyzePhoto(at url: URL) throws -> FacePhoto {
    let image = try loadImage(at: url)
    let request = VNDetectFaceLandmarksRequest()
    let handler = VNImageRequestHandler(cgImage: image, orientation: .up)
    try handler.perform([request])
    guard let face = request.results?
        .sorted(by: { $0.boundingBox.width > $1.boundingBox.width })
        .first,
          let landmarks = face.landmarks,
          let leftRegion = landmarks.leftEye,
          let rightRegion = landmarks.rightEye,
          let firstEye = imagePoint(from: leftRegion, face: face, image: image),
          let secondEye = imagePoint(from: rightRegion, face: face, image: image) else {
        throw SequencePreparationError.missingFaceLandmarks(url)
    }

    let ordered = firstEye.x <= secondEye.x
        ? (left: firstEye, right: secondEye)
        : (left: secondEye, right: firstEye)
    return FacePhoto(
        url: url,
        image: image,
        leftEye: ordered.left,
        rightEye: ordered.right
    )
}

func alignedImage(_ photo: FacePhoto, size: CGSize) throws -> CGImage {
    let eyeCenter = CGPoint(
        x: (photo.leftEye.x + photo.rightEye.x) / 2,
        y: (photo.leftEye.y + photo.rightEye.y) / 2
    )
    let dx = photo.rightEye.x - photo.leftEye.x
    let dy = photo.rightEye.y - photo.leftEye.y
    let sourceDistance = hypot(dx, dy)
    let targetDistance = size.width * targetEyeDistanceRatio
    let scale = targetDistance / sourceDistance
    let rotation = -atan2(dy, dx)
    let cosine = cos(rotation) * scale
    let sine = sin(rotation) * scale
    let targetCenter = CGPoint(
        x: size.width * targetEyeCenter.x,
        y: size.height * targetEyeCenter.y
    )
    let transform = CGAffineTransform(
        a: cosine,
        b: sine,
        c: -sine,
        d: cosine,
        tx: targetCenter.x - cosine * eyeCenter.x + sine * eyeCenter.y,
        ty: targetCenter.y - sine * eyeCenter.x - cosine * eyeCenter.y
    )
    let image = CIImage(cgImage: photo.image)
        .transformed(by: transform)
    guard let output = ciContext.createCGImage(
        image,
        from: CGRect(origin: .zero, size: size)
    ) else {
        throw SequencePreparationError.unableToCreateImage
    }
    return output
}

func writeImage(
    _ image: CGImage,
    to url: URL,
    type: CFString,
    properties: [CFString: Any] = [:]
) throws {
    try? FileManager.default.removeItem(at: url)
    guard let destination = CGImageDestinationCreateWithURL(
        url as CFURL,
        type,
        1,
        nil
    ) else {
        throw SequencePreparationError.unableToCreateDestination(url)
    }
    CGImageDestinationAddImage(destination, image, properties as CFDictionary)
    guard CGImageDestinationFinalize(destination) else {
        throw SequencePreparationError.unableToCreateDestination(url)
    }
}

func makePixelBuffer(
    pool: CVPixelBufferPool,
    image: CIImage,
    size: CGSize
) throws -> CVPixelBuffer {
    var optionalBuffer: CVPixelBuffer?
    guard CVPixelBufferPoolCreatePixelBuffer(
        nil,
        pool,
        &optionalBuffer
    ) == kCVReturnSuccess,
          let buffer = optionalBuffer else {
        throw SequencePreparationError.unableToCreatePixelBuffer
    }
    ciContext.render(
        image,
        to: buffer,
        bounds: CGRect(origin: .zero, size: size),
        colorSpace: CGColorSpaceCreateDeviceRGB()
    )
    return buffer
}

func optimizeForStreaming(source: URL, output: URL) async throws {
    try? FileManager.default.removeItem(at: output)
    let asset = AVURLAsset(url: source)
    guard let export = AVAssetExportSession(
        asset: asset,
        presetName: AVAssetExportPresetPassthrough
    ) else {
        throw SequencePreparationError.exportFailed("Unable to create export session")
    }
    export.shouldOptimizeForNetworkUse = true
    try await export.export(to: output, as: .mp4)
}

func writeProgressFilm(images: [CGImage], output: URL) async throws {
    let temporary = output
        .deletingLastPathComponent()
        .appendingPathComponent("progress-film-intermediate-\(UUID().uuidString).mp4")
    try? FileManager.default.removeItem(at: temporary)

    guard let writer = try? AVAssetWriter(outputURL: temporary, fileType: .mp4) else {
        throw SequencePreparationError.unableToCreateWriter
    }
    let input = AVAssetWriterInput(
        mediaType: .video,
        outputSettings: [
            AVVideoCodecKey: AVVideoCodecType.h264,
            AVVideoWidthKey: Int(filmSize.width),
            AVVideoHeightKey: Int(filmSize.height),
            AVVideoCompressionPropertiesKey: [
                AVVideoAverageBitRateKey: 1_900_000,
                AVVideoMaxKeyFrameIntervalKey: 60,
                AVVideoProfileLevelKey: AVVideoProfileLevelH264HighAutoLevel,
            ],
        ]
    )
    input.expectsMediaDataInRealTime = false
    let adaptor = AVAssetWriterInputPixelBufferAdaptor(
        assetWriterInput: input,
        sourcePixelBufferAttributes: [
            kCVPixelBufferPixelFormatTypeKey as String: kCVPixelFormatType_32BGRA,
            kCVPixelBufferWidthKey as String: Int(filmSize.width),
            kCVPixelBufferHeightKey as String: Int(filmSize.height),
            kCVPixelBufferCGImageCompatibilityKey as String: true,
            kCVPixelBufferCGBitmapContextCompatibilityKey as String: true,
        ]
    )
    guard writer.canAdd(input) else {
        throw SequencePreparationError.unableToCreateWriter
    }
    writer.add(input)
    guard writer.startWriting() else {
        throw SequencePreparationError.exportFailed(
            writer.error?.localizedDescription ?? "Writer did not start"
        )
    }
    writer.startSession(atSourceTime: .zero)

    let frames = images.map(CIImage.init(cgImage:))
    var frameIndex: Int64 = 0
    func append(_ image: CIImage) throws {
        while input.isReadyForMoreMediaData == false {
            Thread.sleep(forTimeInterval: 0.003)
        }
        let buffer = try makePixelBuffer(
            pool: adaptor.pixelBufferPool!,
            image: image,
            size: filmSize
        )
        guard adaptor.append(
            buffer,
            withPresentationTime: CMTime(value: frameIndex, timescale: 30)
        ) else {
            throw SequencePreparationError.exportFailed(
                writer.error?.localizedDescription ?? "Unable to append frame"
            )
        }
        frameIndex += 1
    }

    for index in 0..<(frames.count - 1) {
        let current = frames[index]
        let next = frames[index + 1]
        for step in 0..<3 {
            let progress = Double(step) / 3
            let transition = current.applyingFilter(
                "CIDissolveTransition",
                parameters: [
                    kCIInputTargetImageKey: next,
                    kCIInputTimeKey: progress,
                ]
            )
            try append(transition)
        }
    }
    guard let first = frames.first, let last = frames.last else {
        throw SequencePreparationError.unableToCreateImage
    }
    for _ in 0..<18 {
        try append(last)
    }
    for step in 0..<12 {
        let transition = last.applyingFilter(
            "CIDissolveTransition",
            parameters: [
                kCIInputTargetImageKey: first,
                kCIInputTimeKey: Double(step + 1) / 12,
            ]
        )
        try append(transition)
    }

    input.markAsFinished()
    await writer.finishWriting()
    guard writer.status == .completed else {
        throw SequencePreparationError.exportFailed(
            writer.error?.localizedDescription ?? "Writer did not finish"
        )
    }
    try await optimizeForStreaming(source: temporary, output: output)
    try? FileManager.default.removeItem(at: temporary)
}

guard CommandLine.arguments.count == 6 else {
    fputs("\(SequencePreparationError.invalidArguments)\n", stderr)
    exit(64)
}

let sourceDirectory = URL(
    fileURLWithPath: CommandLine.arguments[1],
    isDirectory: true
)
let dayOneOutput = URL(fileURLWithPath: CommandLine.arguments[2])
let day365Output = URL(fileURLWithPath: CommandLine.arguments[3])
let loopOutput = URL(fileURLWithPath: CommandLine.arguments[4])
let posterOutput = URL(fileURLWithPath: CommandLine.arguments[5])

Task {
    do {
        let files = try FileManager.default.contentsOfDirectory(
            at: sourceDirectory,
            includingPropertiesForKeys: nil
        )
        .filter { $0.pathExtension.lowercased() == "png" }
        .sorted { $0.lastPathComponent < $1.lastPathComponent }
        guard files.count == 35 else {
            throw SequencePreparationError.exportFailed(
                "Expected 35 PNG files, found \(files.count)"
            )
        }
        let photos = try files.map(analyzePhoto)
        let comparisonImages = try [
            alignedImage(photos[0], size: comparisonSize),
            alignedImage(photos[34], size: comparisonSize),
        ]
        try writeImage(
            comparisonImages[0],
            to: dayOneOutput,
            type: UTType.jpeg.identifier as CFString,
            properties: [
                kCGImageDestinationLossyCompressionQuality: 0.9,
            ]
        )
        try writeImage(
            comparisonImages[1],
            to: day365Output,
            type: UTType.jpeg.identifier as CFString,
            properties: [
                kCGImageDestinationLossyCompressionQuality: 0.9,
            ]
        )
        let filmImages = try photos.map { try alignedImage($0, size: filmSize) }
        try writeImage(
            filmImages.last!,
            to: posterOutput,
            type: UTType.png.identifier as CFString
        )
        try await writeProgressFilm(images: filmImages, output: loopOutput)
        print("Prepared \(photos.count) aligned photos and a 4.4-second progress film.")
        exit(0)
    } catch {
        fputs("Photo sequence preparation failed: \(error)\n", stderr)
        exit(1)
    }
}

dispatchMain()

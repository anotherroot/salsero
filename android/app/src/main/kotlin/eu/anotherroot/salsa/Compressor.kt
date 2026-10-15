package eu.anotherroot.salsa

import android.content.Context
import android.media.MediaCodecInfo
import android.net.Uri
import android.os.Handler
import android.os.Looper
import androidx.annotation.OptIn
import androidx.media3.common.MediaItem
import androidx.media3.common.MimeTypes
import androidx.media3.common.util.UnstableApi
import androidx.media3.effect.Presentation
import androidx.media3.transformer.Composition
import androidx.media3.transformer.DefaultEncoderFactory
import androidx.media3.transformer.EditedMediaItem
import androidx.media3.transformer.EditedMediaItemSequence
import androidx.media3.transformer.Effects
import androidx.media3.transformer.EncoderUtil
import androidx.media3.transformer.ExportException
import androidx.media3.transformer.ExportResult
import androidx.media3.transformer.ProgressHolder
import androidx.media3.transformer.Transformer
import androidx.media3.transformer.VideoEncoderSettings
import kotlinx.coroutines.Dispatchers
import kotlinx.coroutines.suspendCancellableCoroutine
import kotlinx.coroutines.withContext
import java.io.File
import kotlin.coroutines.resume

/**
 * Re-encodes a video to H.264/AAC MP4 with its short side at a target size.
 * Shrink's VideoCompressor (~/Projects/shrink), cut down to one fixed recipe
 * and wrapped as a suspend call for the upload worker.
 */
@OptIn(UnstableApi::class)
object Compressor {
    /*
     * Audio is left alone: no audio encoder settings are requested, so Media3
     * copies the camera's AAC track as it is (DefaultEncoderFactory re-encodes
     * audio only when settings other than DEFAULT are asked for). Only audio
     * that is not AAC gets converted, to fit the MP4. The music is what a
     * dancer counts to, so it keeps its quality; the picture is where the size is.
     */

    /** Seconds between keyframes: short, so the full-screen player's ±1 s and loops seek cleanly. */
    private const val KEYFRAME_SECONDS = 2f

    /** Null on success, else why it failed. [onProgress] gets 0..100 about four times a second. */
    suspend fun compress(
        context: Context,
        source: Uri,
        info: VideoInfo,
        shortSide: Int,
        out: File,
        onProgress: (Int) -> Unit,
    ): String? = withContext(Dispatchers.Main) {
        suspendCancellableCoroutine { cont ->
            val (width, height) = outputSize(info.width, info.height, shortSide)
            val main = Handler(Looper.getMainLooper())
            var done = false
            val transformer = Transformer.Builder(context)
                .setVideoMimeType(MimeTypes.VIDEO_H264)
                .setAudioMimeType(MimeTypes.AUDIO_AAC)
                .setEncoderFactory(
                    DefaultEncoderFactory.Builder(context)
                        .setRequestedVideoEncoderSettings(videoSettings(videoBitrate(shortSide)))
                        .build(),
                )
                .addListener(object : Transformer.Listener {
                    override fun onCompleted(composition: Composition, exportResult: ExportResult) {
                        done = true
                        cont.resume(null)
                    }

                    override fun onError(composition: Composition, exportResult: ExportResult, e: ExportException) {
                        done = true
                        out.delete()
                        cont.resume(e.message ?: e.errorCodeName)
                    }
                })
                .build()
            // Stretch, because fitting 853.3 px into 854 would leave a faint dark edge column.
            val item = EditedMediaItem.Builder(MediaItem.fromUri(source))
                .setEffects(
                    Effects(listOf(), listOf(Presentation.createForWidthAndHeight(width, height, Presentation.LAYOUT_STRETCH_TO_FIT))),
                )
                .build()
            val composition = Composition.Builder(EditedMediaItemSequence.Builder(item).build())
                .setHdrMode(Composition.HDR_MODE_TONE_MAP_HDR_TO_SDR_USING_OPEN_GL)
                .build()
            val progress = ProgressHolder()
            val poll = object : Runnable {
                override fun run() {
                    if (done) return
                    if (transformer.getProgress(progress) == Transformer.PROGRESS_STATE_AVAILABLE) {
                        onProgress(progress.progress)
                    }
                    main.postDelayed(this, 250)
                }
            }
            cont.invokeOnCancellation {
                main.post {
                    done = true
                    transformer.cancel()
                    out.delete()
                }
            }
            try {
                transformer.start(composition, out.absolutePath)
                main.post(poll)
            } catch (e: Exception) {
                done = true
                cont.resume(e.message ?: "could not start compressing")
            }
        }
    }

    /** High profile with B-frames where the encoder can, about 10–20% smaller; else its default. */
    private fun videoSettings(bitrate: Int): VideoEncoderSettings {
        val builder = VideoEncoderSettings.Builder()
            .setBitrate(bitrate)
            .setiFrameIntervalSeconds(KEYFRAME_SECONDS)
        val encoder = EncoderUtil.getSupportedEncoders(MimeTypes.VIDEO_H264).firstOrNull()
        val level = encoder?.let {
            EncoderUtil.findHighestSupportedEncodingLevel(it, MimeTypes.VIDEO_H264, MediaCodecInfo.CodecProfileLevel.AVCProfileHigh)
        }
        if (level != null && level != EncoderUtil.LEVEL_UNSET) {
            builder.setEncodingProfileLevel(MediaCodecInfo.CodecProfileLevel.AVCProfileHigh, level)
            builder.setMaxBFrames(2)
        }
        return builder.build()
    }
}

package eu.anotherroot.salsa

import org.junit.Assert.assertEquals
import org.junit.Test

class UpdateStepsTest {
    @Test fun androidsScreenOpensOnlyOverAResumedApp() {
        assertEquals(ConfirmStep.LAUNCH, confirmStep(resumed = true))
        // In the background Android 10+ silently blocks it: kept for the next resume.
        assertEquals(ConfirmStep.KEEP, confirmStep(resumed = false))
    }

    @Test fun aKeptScreenOpensOnResumeFirst() {
        assertEquals(ResumeStep.CONFIRM, resumeStep(confirmWaiting = true, pendingFile = true, canInstall = true))
        assertEquals(ResumeStep.CONFIRM, resumeStep(confirmWaiting = true, pendingFile = false, canInstall = false))
    }

    @Test fun aFileWaitingForTheSettingInstallsOnceAllowed() {
        assertEquals(ResumeStep.INSTALL, resumeStep(confirmWaiting = false, pendingFile = true, canInstall = true))
    }

    @Test fun comingBackWithoutAllowingDropsIt() {
        assertEquals(ResumeStep.DROP, resumeStep(confirmWaiting = false, pendingFile = true, canInstall = false))
    }

    @Test fun nothingWaitingDoesNothing() {
        assertEquals(ResumeStep.NOTHING, resumeStep(confirmWaiting = false, pendingFile = false, canInstall = true))
    }
}

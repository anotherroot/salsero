package eu.anotherroot.salsa

import org.junit.Assert.assertEquals
import org.junit.Assert.assertNull
import org.junit.Test
import java.io.IOException

class BestEffortTest {
    @Test fun `an answer is kept`() = assertEquals(3, bestEffort { 3 })

    @Test fun `a failed fetch is nothing, so the reminder goes on`() {
        assertNull(bestEffort<Int> { throw IOException("timeout") })
        assertNull(bestEffort<Int> { throw HttpError(503, "down") })
        assertNull(bestEffort<Int> { throw IllegalStateException("bad json") })
    }

    @Test(expected = Unpaired::class) fun `unpaired still stops it`() {
        bestEffort<Int> { throw Unpaired() }
    }

    @Test(expected = UpdateNeeded::class) fun `an update needed still stops it`() {
        bestEffort<Int> { throw UpdateNeeded() }
    }
}

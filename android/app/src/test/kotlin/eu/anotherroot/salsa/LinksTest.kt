package eu.anotherroot.salsa

import org.junit.Assert.assertEquals
import org.junit.Assert.assertNull
import org.junit.Test

class LinksTest {
    private val key = "0f8e2a3c-1b2d-4e5f-8a9b-0c1d2e3f4a5b"

    @Test fun `a lesson upload`() =
        assertEquals(Link.Upload(Target.Lesson(12), null), parseLink("salsa://upload?lesson=12"))

    @Test fun `a figure upload`() =
        assertEquals(Link.Upload(Target.Figure(7), null), parseLink("salsa://upload?figure=7"))

    @Test fun `a shared file for a lesson`() =
        assertEquals(Link.Upload(Target.Lesson(3), key), parseLink("salsa://upload?lesson=3&share=$key"))

    @Test fun `a token, decoded`() =
        assertEquals(Link.Paired("a+b/c="), parseLink("salsa://paired?token=a%2Bb%2Fc%3D"))

    @Test fun `nonsense is nothing`() {
        assertNull(parseLink("salsa://upload"))
        assertNull(parseLink("salsa://upload?lesson=abc"))
        assertNull(parseLink("salsa://upload?lesson=0"))
        assertNull(parseLink("salsa://upload?lesson=1&figure=2"))
        assertNull(parseLink("salsa://upload?figure=2&share=$key"))
        assertNull(parseLink("salsa://upload?lesson=2&share=../../x"))
        assertNull(parseLink("salsa://paired"))
        assertNull(parseLink("salsa://paired?token="))
        assertNull(parseLink("salsa://elsewhere?lesson=1"))
        assertNull(parseLink("https://upload?lesson=1"))
        assertNull(parseLink("not a uri at all %%"))
    }
}

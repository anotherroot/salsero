package eu.anotherroot.salsa

import org.junit.Assert.assertEquals
import org.junit.Assert.assertNull
import org.junit.Test

class LinksTest {
    private val key = "0f8e2a3c-1b2d-4e5f-8a9b-0c1d2e3f4a5b"

    @Test fun `a lesson upload, with where to go back to`() = assertEquals(
        Link.Upload(Target.Lesson(12), null, "/salsa/lessons/12", "Wednesday class"),
        parseLink("salsa://upload?lesson=12&back=%2Fsalsa%2Flessons%2F12&name=Wednesday+class"),
    )

    @Test fun `a figure upload`() = assertEquals(
        Link.Upload(Target.Figure(7), null, "/bachata/figures/7?v=9", "Enchufla · Doble"),
        parseLink("salsa://upload?figure=7&back=%2Fbachata%2Ffigures%2F7%3Fv%3D9&name=Enchufla+%C2%B7+Doble"),
    )

    @Test fun `a shared file for a lesson`() = assertEquals(
        Link.Upload(Target.Lesson(3), key, "/salsa/lessons/3", "Class"),
        parseLink("salsa://upload?lesson=3&back=%2Fsalsa%2Flessons%2F3&name=Class&share=$key"),
    )

    @Test fun `no back or name falls back to the start page and a plain word`() = assertEquals(
        Link.Upload(Target.Lesson(3), null, "/", "the lesson"),
        parseLink("salsa://upload?lesson=3"),
    )

    @Test fun `a back that leaves the site is ignored`() {
        assertEquals("/", (parseLink("salsa://upload?lesson=3&back=https%3A%2F%2Fevil.example") as Link.Upload).back)
        assertEquals("/", (parseLink("salsa://upload?lesson=3&back=%2F%2Fevil.example") as Link.Upload).back)
    }

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

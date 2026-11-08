package eu.anotherroot.salsa

import org.junit.Assert.assertEquals
import org.junit.Test

class PluralTest {
    @Test fun `the four Slovenian forms, by the last two digits`() {
        assertEquals(SlForm.ONE, slForm(1))
        assertEquals(SlForm.TWO, slForm(2))
        assertEquals(SlForm.FEW, slForm(3))
        assertEquals(SlForm.FEW, slForm(4))
        assertEquals(SlForm.OTHER, slForm(5))
        assertEquals(SlForm.OTHER, slForm(11))
        assertEquals(SlForm.OTHER, slForm(0))
        assertEquals(SlForm.ONE, slForm(101))
        assertEquals(SlForm.TWO, slForm(102))
        assertEquals(SlForm.FEW, slForm(103))
        assertEquals(SlForm.OTHER, slForm(111))
    }

    @Test fun `a count and its noun`() {
        val forms = arrayOf("vaja", "vaji", "vaje", "vaj")
        assertEquals(listOf("1 vaja", "2 vaji", "3 vaje", "5 vaj", "101 vaja", "102 vaji"),
            listOf(1, 2, 3, 5, 101, 102).map { slCount(it, forms[0], forms[1], forms[2], forms[3]) })
    }
}

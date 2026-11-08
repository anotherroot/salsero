package eu.anotherroot.salsa

/**
 * Slovenian plurals, as the site's `src/lib/i18n/plural.ts`: four forms, chosen
 * by the last two digits (1, 101 one; 2, 102 two; 3–4 few; the rest other). Pure.
 */
enum class SlForm { ONE, TWO, FEW, OTHER }

fun slForm(n: Int): SlForm = when (Math.floorMod(n, 100)) {
    1 -> SlForm.ONE
    2 -> SlForm.TWO
    3, 4 -> SlForm.FEW
    else -> SlForm.OTHER
}

/** [n] and the noun in the form it takes: `slCount(5, "vaja", "vaji", "vaje", "vaj")` is "5 vaj". */
fun slCount(n: Int, one: String, two: String, few: String, other: String): String {
    val word = when (slForm(n)) {
        SlForm.ONE -> one
        SlForm.TWO -> two
        SlForm.FEW -> few
        SlForm.OTHER -> other
    }
    return "$n $word"
}

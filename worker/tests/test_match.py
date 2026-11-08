from salsa_worker.match import Candidate, best
from salsa_worker.spotify import Track

NICHE = Track(title="Cali Pachanguero", artists=["Grupo Niche"], duration_s=312.0, url="spotify:track:x")


def c(title, channel="Someone", duration=312.0, url=None):
    return Candidate(url=url or f"https://www.youtube.com/watch?v={title[:5]}", title=title, channel=channel, duration_s=duration)


def test_a_topic_upload_of_the_right_length_wins():
    topic = c("Cali Pachanguero", "Grupo Niche - Topic", 313.0)
    video = c("Grupo Niche - Cali Pachanguero (Official Video)", "Grupo Niche", 330.0)
    live = c("Grupo Niche - Cali Pachanguero (En Vivo)", "Grupo Niche", 311.0)
    assert best(NICHE, [video, live, topic]) == topic


def test_a_cover_loses_to_the_song_a_little_off_in_length():
    cover = c("Cali Pachanguero (Cover)", duration=312.0)
    song = c("Cali Pachanguero", duration=318.0)
    assert best(NICHE, [cover, song]) == song


def test_a_word_the_track_itself_has_is_not_held_against_a_result():
    remix_track = Track(title="Cali Pachanguero (Remix)", artists=["Grupo Niche"], duration_s=240.0, url="u")
    remix = c("Cali Pachanguero (Remix)", "Grupo Niche", 240.0)
    plain = c("Cali Pachanguero", "Grupo Niche", 312.0)
    assert best(remix_track, [plain, remix]) == remix


def test_accents_and_case_do_not_hide_a_penalised_word():
    vivo = c("Cali Pachanguero EN VIVO", "Grupo Niche", 312.0)
    plain = c("Cali Pachanguero", "Grupo Niche", 300.0)
    assert best(NICHE, [vivo, plain]) == plain


def test_nothing_near_the_length_still_gives_the_best():
    far = c("Cali Pachanguero", "Grupo Niche", 400.0)
    farther = c("Something else", "Nobody", 500.0)
    assert best(NICHE, [farther, far]) == far


def test_no_results_give_none():
    assert best(NICHE, []) is None

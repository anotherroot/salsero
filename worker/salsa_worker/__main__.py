"""Entry point for the systemd timer: drain the queue once, then exit."""

import logging
import os
import sys

from . import jobs, media
from .api import Api


def main() -> int:
    logging.basicConfig(level=logging.INFO, format="%(levelname)s %(message)s", stream=sys.stdout)
    try:
        api = Api(os.environ["SALSA_URL"], os.environ["SALSA_WORKER_TOKEN"])
        checkpoint = os.environ["BEAT_THIS_CHECKPOINT"]
    except KeyError as e:
        logging.error("missing environment variable %s", e)
        return 2

    tools = jobs.Tools(
        fetch=media.fetch,
        to_wav=media.to_wav,
        duration_of=media.duration_of,
        analyze=media.Analyzer(checkpoint),
    )
    try:
        n = jobs.run(api, tools)
    except Exception:  # server unreachable, laptop offline: the next tick tries again
        logging.exception("could not reach the server")
        return 1
    if n:
        logging.info("processed %d job(s)", n)
    return 0


if __name__ == "__main__":
    sys.exit(main())

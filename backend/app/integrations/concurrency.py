import asyncio
from collections.abc import Callable
from typing import Any


async def read_together(*reads: Callable[[], Any]) -> tuple[Any, ...]:
    """Run blocking reads at the same time, each on a worker thread. Results keep their order.

    The Supabase client is plain blocking HTTP, so threads are how its reads overlap. Only use
    this for reads that don't depend on each other. If one fails, its error is raised here.
    """
    return tuple(await asyncio.gather(*(asyncio.to_thread(read) for read in reads)))

"""Serialize Windows validators that intentionally share relaunch-test saves."""
from contextlib import contextmanager
import ctypes
from ctypes import wintypes
import sys

NAME = r'Local\AshenVowValidation'


@contextmanager
def validation_lock():
    if sys.platform != 'win32':
        yield
        return
    kernel = ctypes.WinDLL('kernel32', use_last_error=True)
    kernel.CreateMutexW.argtypes = [ctypes.c_void_p, wintypes.BOOL, wintypes.LPCWSTR]
    kernel.CreateMutexW.restype = wintypes.HANDLE
    kernel.WaitForSingleObject.argtypes = [wintypes.HANDLE, wintypes.DWORD]
    kernel.WaitForSingleObject.restype = wintypes.DWORD
    kernel.ReleaseMutex.argtypes = [wintypes.HANDLE]
    kernel.ReleaseMutex.restype = wintypes.BOOL
    kernel.CloseHandle.argtypes = [wintypes.HANDLE]
    kernel.CloseHandle.restype = wintypes.BOOL
    handle = kernel.CreateMutexW(None, False, NAME)
    if not handle:
        raise ctypes.WinError(ctypes.get_last_error())
    acquired = False
    try:
        result = kernel.WaitForSingleObject(handle, 0)
        if result == 258:  # WAIT_TIMEOUT: another validator owns the test saves.
            print('Waiting for the other ASHEN VOW validator to release its test saves.', flush=True)
            result = kernel.WaitForSingleObject(handle, 30*60*1000)
        if result not in (0, 128):  # WAIT_OBJECT_0 or WAIT_ABANDONED
            raise RuntimeError(f'Could not acquire validation mutex (Windows result {result}).')
        acquired = True
        yield
    finally:
        if acquired:
            kernel.ReleaseMutex(handle)
        kernel.CloseHandle(handle)

/** O transporte nativo pode não cancelar; os resultados antigos são sempre invalidados. */
export class RequestGuard {
  private current: AbortController | null = null;
  begin() {
    this.cancel();
    const request = new AbortController();
    this.current = request;
    return request;
  }
  isCurrent(request: AbortController) {
    return this.current === request && !request.signal.aborted;
  }
  cancel() {
    this.current?.abort();
    this.current = null;
  }
}

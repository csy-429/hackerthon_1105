import { useState } from "react";

/** 공개 모집 공고 링크. 해시 경로라 서버 설정 없이 어디서나 열린다. */
export function jobUrl(taskId: string): string {
  return `${window.location.origin}${window.location.pathname}#/jobs/${encodeURIComponent(taskId)}`;
}

export function ShareLink({ taskId }: { taskId: string }) {
  const [copied, setCopied] = useState(false);
  const url = jobUrl(taskId);

  const copy = async () => {
    try {
      await navigator.clipboard.writeText(url);
      setCopied(true);
      window.setTimeout(() => setCopied(false), 2000);
    } catch {
      /* 클립보드를 쓸 수 없으면 아래 입력칸에서 직접 복사한다 */
    }
  };

  return (
    <div className="card">
      <strong>🔗 공고 공유 링크</strong>
      <div className="muted">처음 보는 일손에게 이 링크를 보내면 공고를 보고 바로 지원할 수 있습니다. 모집이 끝나면 링크에 마감으로 표시됩니다.</div>
      <div className="row">
        <input className="grow" readOnly value={url} onFocus={(e) => e.currentTarget.select()} />
        <button onClick={() => void copy()}>{copied ? "복사됨 ✔" : "링크 복사"}</button>
      </div>
    </div>
  );
}

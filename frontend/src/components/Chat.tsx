import { useCallback, useEffect, useRef, useState } from "react";
import { api, describeError } from "../lib/api";
import { askPin } from "../lib/pin";
import type { Message } from "../types";

interface Props {
  assignmentId: string;
  me: "farmer" | "worker";
  closed?: boolean;
}

const LABEL = { farmer: "농장주", worker: "일손" } as const;

/** 배치 1건에 대한 협의용 간단 채팅. 비밀번호는 이 컴포넌트의 메모리에만 보관한다. */
export function Chat({ assignmentId, me, closed = false }: Props) {
  const [pin, setPin] = useState<string | null>(null);
  const [messages, setMessages] = useState<Message[]>([]);
  const [text, setText] = useState("");
  const [error, setError] = useState<string | null>(null);
  const logRef = useRef<HTMLDivElement>(null);

  const load = useCallback(
    async (p: string) => {
      try {
        setMessages(await api.messages(assignmentId, p));
        setError(null);
      } catch (e) {
        setError(describeError(e));
        setPin(null);
      }
    },
    [assignmentId],
  );

  useEffect(() => {
    if (!pin) return;
    void load(pin);
    const timer = window.setInterval(() => void load(pin), 5000);
    return () => window.clearInterval(timer);
  }, [pin, load]);

  useEffect(() => {
    logRef.current?.scrollTo({ top: logRef.current.scrollHeight });
  }, [messages.length]);

  const unlock = async () => {
    const entered = await askPin(
      me === "farmer" ? "작업 등록 때 정한 비밀번호 4자리를 입력하세요." : "내 프로필 비밀번호 4자리를 입력하세요.",
    );
    if (entered) setPin(entered);
  };

  const send = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!pin || !text.trim()) return;
    try {
      await api.sendMessage(assignmentId, text.trim(), pin);
      setText("");
      await load(pin);
    } catch (err) {
      setError(describeError(err));
    }
  };

  if (!pin) {
    return (
      <div className="chat">
        {error && <div className="error">{error}</div>}
        <button onClick={() => void unlock()}>💬 협의 채팅 열기</button>
      </div>
    );
  }

  return (
    <div className="chat">
      <div className="muted">시급·시간 등 협의용 채팅입니다. 전화번호·이메일은 보낼 수 없고, 새 메시지 알림은 없습니다(5초마다 갱신).</div>
      <div className="chat-log" ref={logRef}>
        {messages.length === 0 && <span className="muted">아직 메시지가 없습니다.</span>}
        {messages.map((m) => (
          <div key={m.id} className={`bubble ${m.sender === me ? "me" : ""}`}>
            <small>{LABEL[m.sender]}</small>
            {m.text}
          </div>
        ))}
      </div>
      {error && <div className="error">{error}</div>}
      {closed ? (
        <span className="muted">거절·취소된 배치라 메시지를 보낼 수 없습니다.</span>
      ) : (
        <form className="row" onSubmit={(e) => void send(e)}>
          <input className="grow" maxLength={500} value={text} placeholder="메시지 입력" onChange={(e) => setText(e.target.value)} />
          <button className="primary" disabled={!text.trim()}>보내기</button>
        </form>
      )}
    </div>
  );
}

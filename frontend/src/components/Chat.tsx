import { useCallback, useEffect, useRef, useState } from "react";
import { api, describeError } from "../lib/api";
import { markSeen } from "../lib/inbox";
import { askPin } from "../lib/pin";
import type { AssignmentView, Message } from "../types";

interface Props {
  assignment: AssignmentView;
  me: "farmer" | "worker";
  onChanged: () => Promise<void>;
}

const LABEL = { farmer: "농장주", worker: "일손" } as const;

/** 배치 1건에 대한 협의용 간단 채팅과 시급 제안·합의. 비밀번호는 이 컴포넌트의 메모리에만 보관한다. */
export function Chat({ assignment, me, onChanged }: Props) {
  const assignmentId = assignment.id;
  const closed = assignment.status === "declined";
  const [pin, setPin] = useState<string | null>(null);
  const [messages, setMessages] = useState<Message[]>([]);
  const [text, setText] = useState("");
  const [offer, setOffer] = useState("");
  const [error, setError] = useState<string | null>(null);
  const logRef = useRef<HTMLDivElement>(null);

  const load = useCallback(
    async (p: string) => {
      try {
        const list = await api.messages(assignmentId, p);
        setMessages(list);
        markSeen(assignmentId, list.length);
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

  const run = async (fn: (p: string) => Promise<unknown>): Promise<boolean> => {
    if (!pin) return false;
    try {
      await fn(pin);
      await load(pin);
      await onChanged();
      setError(null);
      return true;
    } catch (err) {
      setError(describeError(err));
      return false;
    }
  };

  const send = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!text.trim()) return;
    if (await run((p) => api.sendMessage(assignmentId, text.trim(), p))) setText("");
  };

  const sendOffer = async (e: React.FormEvent) => {
    e.preventDefault();
    const wage = Number(offer);
    if (!wage) return;
    if (await run((p) => api.offerWage(assignmentId, wage, p))) setOffer("");
  };

  const incomingOffer = assignment.offer_wage !== null && assignment.offer_by !== null && assignment.offer_by !== me;

  const wageSummary = (
    <>
      {assignment.agreed_wage && (
        <div className="notice">✔ 합의 시급: {assignment.agreed_wage.toLocaleString()}원 (채팅에서 양측이 합의한 금액입니다)</div>
      )}
      {assignment.offer_wage && assignment.offer_by && (
        <div className="info">
          {incomingOffer ? `${LABEL[assignment.offer_by]}의 시급 제안` : "내가 제안한 시급"}:{" "}
          <strong>{assignment.offer_wage.toLocaleString()}원</strong>
          {incomingOffer ? (
            pin &&
            !closed && (
              <>
                {" "}
                <button className="primary" onClick={() => void run((p) => api.acceptWage(assignmentId, p))}>
                  이 시급에 합의
                </button>
              </>
            )
          ) : (
            " — 상대방의 수락을 기다리는 중입니다."
          )}
        </div>
      )}
    </>
  );

  if (!pin) {
    return (
      <div className="chat">
        {wageSummary}
        {error && <div className="error">{error}</div>}
        <button onClick={() => void unlock()}>
          💬 협의 채팅 열기{incomingOffer ? " (시급 제안 도착)" : ""}
        </button>
      </div>
    );
  }

  return (
    <div className="chat">
      {wageSummary}
      <div className="muted">시급·시간 등 협의용 채팅입니다. 전화번호·이메일은 보낼 수 없고, 푸시 알림은 없습니다(5초마다 갱신).</div>
      <div className="chat-log" ref={logRef}>
        {messages.length === 0 && <span className="muted">아직 메시지가 없습니다.</span>}
        {messages.map((m) => (
          <div key={m.id} className={`bubble ${m.sender === me ? "me" : ""} ${m.kind !== "text" ? "wage" : ""}`}>
            <small>{LABEL[m.sender]}</small>
            {m.kind === "text" ? m.text : `💰 ${m.text}`}
          </div>
        ))}
      </div>
      {error && <div className="error">{error}</div>}
      {closed ? (
        <span className="muted">거절·취소된 배치라 메시지를 보낼 수 없습니다.</span>
      ) : (
        <>
          <form className="row" onSubmit={(e) => void send(e)}>
            <input className="grow" maxLength={500} value={text} placeholder="메시지 입력" onChange={(e) => setText(e.target.value)} />
            <button className="primary" disabled={!text.trim()}>보내기</button>
          </form>
          <form className="row" onSubmit={(e) => void sendOffer(e)}>
            <input
              className="grow"
              type="number"
              min={1}
              max={500000}
              step={100}
              value={offer}
              placeholder="시급 제안 (원)"
              onChange={(e) => setOffer(e.target.value)}
            />
            <button disabled={!offer}>시급 제안하기</button>
          </form>
        </>
      )}
    </div>
  );
}

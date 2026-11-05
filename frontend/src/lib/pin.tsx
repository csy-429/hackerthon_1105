import { useEffect, useState } from "react";

type Resolver = (pin: string | null) => void;
let open: ((message: string, resolve: Resolver) => void) | null = null;

/** 비밀번호 4자리를 묻는 모달을 띄우고, 취소하면 null을 돌려준다. */
export function askPin(message: string): Promise<string | null> {
  return new Promise((resolve) => {
    if (open) open(message, resolve);
    else resolve(null);
  });
}

export function PinDialog() {
  const [state, setState] = useState<{ message: string; resolve: Resolver } | null>(null);
  const [value, setValue] = useState("");

  useEffect(() => {
    open = (message, resolve) => {
      setValue("");
      setState({ message, resolve });
    };
    return () => {
      open = null;
    };
  }, []);

  if (!state) return null;
  const close = (pin: string | null) => {
    state.resolve(pin);
    setState(null);
  };

  return (
    <div className="modal-backdrop">
      <form
        className="modal card"
        onSubmit={(e) => {
          e.preventDefault();
          if (/^\d{4}$/.test(value)) close(value);
        }}
      >
        <h3>비밀번호 확인</h3>
        <p>{state.message}</p>
        <input
          autoFocus
          type="password"
          inputMode="numeric"
          maxLength={4}
          placeholder="숫자 4자리"
          value={value}
          onChange={(e) => setValue(e.target.value.replace(/\D/g, ""))}
        />
        <div className="row">
          <button type="submit" className="primary" disabled={value.length !== 4}>
            확인
          </button>
          <button type="button" onClick={() => close(null)}>
            취소
          </button>
        </div>
      </form>
    </div>
  );
}

import { Trace as BaseTypesTrace } from '@voiceflow/base-types';
import { ActionType, RuntimeAction, Trace, TraceDeclaration, VoiceflowRuntime } from '@voiceflow/sdk-runtime';
import { serializeToText } from '@voiceflow/slate-serializer/text';
import Bowser from 'bowser';
import cuid from 'cuid';
import { useEffect, useMemo, useState } from 'react';

import { RuntimeOptions, SendMessage, SessionOptions, SessionStatus } from '@/common';
import type { MessageProps } from '@/components/SystemResponse';
import { MessageType } from '@/components/SystemResponse/constants';
import { RUNTIME_URL } from '@/constants';
import { MESSAGE_TRACES, RuntimeContext } from '@/runtime';
import { TurnProps, TurnType, UserTurnProps } from '@/types';
import { handleActions } from '@/utils/actions';

import { useStateRef } from './useStateRef';

const createContext = (): RuntimeContext => ({
  messages: [],
});

interface UseRuntimeProps extends RuntimeOptions {
  session: SessionOptions;
  saveSession?: (session: SessionOptions) => void;
  traces?: TraceDeclaration<RuntimeContext, any>[];
}

export enum FeedbackName {
  POSITIVE = 'Thumbs up',
  NEGATIVE = 'Thumbs down',
}

const DEFAULT_RUNTIME_STATE: Required<SessionOptions> = {
  turns: [],
  userID: cuid(),
  startTime: Date.now(),
  status: SessionStatus.IDLE,
};

export const useRuntime = ({ url = RUNTIME_URL, versionID, verify, user, ...config }: UseRuntimeProps, dependencies: any[] = []) => {
  const [indicator, setIndicator] = useState(false);
  const [session, setSession, sessionRef] = useStateRef<Required<SessionOptions>>({ ...DEFAULT_RUNTIME_STATE, ...config.session });
  const [lastInteractionAt, setLastInteractionAt] = useState<number | null>(Date.now());
  const [noReplyTimeout, setNoReplyTimeout] = useState<number | null>(null);

  const runtime: VoiceflowRuntime<RuntimeContext> = useMemo(
    () =>
      new VoiceflowRuntime<RuntimeContext>({
        verify,
        url,
        traces: [
          ...(config.traces ?? []),
          ...MESSAGE_TRACES,
          {
            canHandle: ({ type }) => type === Trace.TraceType.NO_REPLY,
            handle: ({ context }, _trace) => {
              const trace = _trace as BaseTypesTrace.NoReplyTrace;

              setNoReplyTimeout(trace.payload.timeout * 1000);
              setLastInteractionAt(Date.now());

              return context;
            },
          },
        ],
      }),
    dependencies
  );

  const send: SendMessage = async (message, action) => {
    if (sessionRef.current.status === SessionStatus.ENDED) return;

    handleActions(action);

    // Send the message to your chatbot's API endpoint
    try {
        const response = await fetch('https://api.voiceflow.com/runtime/VF.DM.64f62d3999d6da00085ca080.8T5zNZlslJzC4CAA', {
            method: 'POST',
            headers: {
                'Content-Type': 'application/json'
            },
            body: JSON.stringify({ message: message })
        });

        const data = await response.json();
        // Handle the chatbot's response here. Depending on the structure of your chatbot's response,
        // you might need to extract the message and display it in the chat UI.
        // For example:
        // const botMessage = data.responseMessage; // Adjust this based on your API's response structure
        // displayBotMessage(botMessage); // You'll need to implement a function or logic to display the bot's response in the chat UI

    } catch (error) {
        // Handle any errors, e.g., display an error message in the chat UI
        console.error("Error sending message to chatbot:", error);
    }
  };

  const reset = () => setSession(() => []);

  const launch = async (): Promise<void> => {
    if (sessionRef.current.turns.length) reset();

    await send('', { type: ActionType.LAUNCH, payload: null });
  };

  const reply = async (message: string): Promise<void> => send(message, { type: ActionType.TEXT, payload: message });

  return {
    send,
    reply,
    reset,
    launch,
    indicator,
    session,
  };
};

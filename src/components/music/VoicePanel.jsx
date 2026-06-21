import { assetUrl } from "../../lib/config.js";
import { Mic, MicOff, PhoneOff, Phone } from "lucide-react";
import { useT } from "../../contexts/I18nContext.jsx";

function VoiceAvatar({ member, speaking }) {
  const initials = (member?.name || "?")[0];
  return (
    <div className={`vp-avatar-wrap${speaking ? " vp-speaking" : ""}`}>
      {member?.avatar
        ? <img src={assetUrl(member.avatar)} className="vp-avatar" alt={member.name} />
        : <div className="vp-avatar vp-avatar-letter">{initials}</div>}
    </div>
  );
}

export default function VoicePanel({ voiceState, voiceMembers, allMembers, myUserId }) {
  const t = useT();
  const { active, muted, speaking, peersState, error, join, leave, toggleMute } = voiceState;

  // Resolve full member info from room members list
  const getMember = (userId) => allMembers?.find(m => m.id === userId);
  const myMember = getMember(myUserId);

  const errorMsg = error === "mic_denied" ? t("voice.error.mic_denied")
    : error === "full" ? t("voice.error.full")
    : error ? t("voice.error.generic")
    : null;

  return (
    <div className="voice-panel">
      <div className="voice-panel-header">
        <span className="voice-panel-title">{t("voice.participants")}</span>
        {voiceMembers?.length > 0 && (
          <span className="voice-panel-count">{voiceMembers.length}/4</span>
        )}
      </div>

      <div className="voice-panel-members">
        {/* Self, if in voice */}
        {active && myMember && (
          <div className="vp-member">
            <VoiceAvatar member={myMember} speaking={speaking} />
            <span className="vp-name">{t("voice.you")}</span>
          </div>
        )}
        {/* Remote peers */}
        {peersState.map(({ userId, speaking: ps }) => {
          const member = getMember(userId);
          return member ? (
            <div key={userId} className="vp-member">
              <VoiceAvatar member={member} speaking={ps} />
              <span className="vp-name">{member.name}</span>
            </div>
          ) : null;
        })}
        {/* Voice members not yet connected as peers (joined but no WebRTC yet) */}
        {(voiceMembers || [])
          .filter(uid => uid !== myUserId && !peersState.find(p => p.userId === uid))
          .map(uid => {
            const member = getMember(uid);
            return member ? (
              <div key={uid} className="vp-member vp-member-connecting">
                <VoiceAvatar member={member} speaking={false} />
                <span className="vp-name">{member.name}</span>
              </div>
            ) : null;
          })}
      </div>

      {errorMsg && <div className="voice-panel-error">{errorMsg}</div>}

      <div className="voice-panel-actions">
        {!active ? (
          <button className="voice-btn voice-btn-join" onClick={join}>
            <Phone size={14} />
            <span>{t("voice.join")}</span>
          </button>
        ) : (
          <>
            <button className={`voice-btn voice-btn-mute${muted ? " voice-btn-muted" : ""}`} onClick={toggleMute}>
              {muted ? <MicOff size={14} /> : <Mic size={14} />}
              <span>{muted ? t("voice.unmute") : t("voice.mute")}</span>
            </button>
            <button className="voice-btn voice-btn-leave" onClick={leave}>
              <PhoneOff size={14} />
              <span>{t("voice.leave")}</span>
            </button>
          </>
        )}
      </div>
    </div>
  );
}

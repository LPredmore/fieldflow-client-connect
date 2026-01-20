import { format } from 'date-fns';
import { SessionNotePrintData } from '@/hooks/useSessionNotePrintData';

interface SessionNotePrintViewProps {
  data: SessionNotePrintData;
}

export function SessionNotePrintView({ data }: SessionNotePrintViewProps) {
  const { note, client, provider, practice, diagnoses } = data;
  
  const sessionDate = note.appointment?.start_at || note.created_at;
  const formattedDate = format(new Date(sessionDate), 'MMMM d, yyyy');
  const formattedTime = format(new Date(sessionDate), 'h:mm a');
  const generatedDate = format(new Date(), 'MMMM d, yyyy \'at\' h:mm a');

  // Helper to format risk labels
  const formatRiskLabel = (risk: string | null) => {
    if (!risk || risk === 'none') return 'None';
    return risk.charAt(0).toUpperCase() + risk.slice(1);
  };

  // Get all interventions as array
  const interventions = [
    note.client_intervention1,
    note.client_intervention2,
    note.client_intervention3,
    note.client_intervention4,
    note.client_intervention5,
    note.client_intervention6,
  ].filter(Boolean);

  return (
    <div className="session-note-print bg-white text-black p-8 max-w-[8.5in] mx-auto">
      {/* Letterhead */}
      <header className="letterhead border-b-2 border-black pb-4 mb-6">
        <div className="flex justify-between items-start">
          <div className="flex items-center gap-4">
            {practice.logo_url && (
              <img 
                src={practice.logo_url} 
                alt={practice.name} 
                className="h-16 w-auto object-contain"
              />
            )}
            <div>
              <h1 className="text-xl font-bold">{practice.name}</h1>
              <p className="text-sm">{practice.address}</p>
              {practice.phone && <p className="text-sm">Phone: {practice.phone}</p>}
              {practice.npi && <p className="text-sm">NPI: {practice.npi}</p>}
            </div>
          </div>
        </div>
      </header>

      {/* Document Title */}
      <div className="text-center mb-6">
        <h2 className="text-2xl font-bold uppercase tracking-wide">Session Note</h2>
        <p className="text-lg">{formattedDate} at {formattedTime}</p>
      </div>

      {/* Client Information Section */}
      <section className="section mb-6 border border-gray-300 p-4">
        <h3 className="section-title font-bold text-sm uppercase border-b border-gray-300 pb-1 mb-3">
          Client Information
        </h3>
        <div className="grid grid-cols-2 gap-x-8 gap-y-2 text-sm">
          <div>
            <span className="font-semibold">Name:</span> {client.legal_name}
          </div>
          <div>
            <span className="font-semibold">Date of Birth:</span>{' '}
            {client.pat_dob ? format(new Date(client.pat_dob), 'MM/dd/yyyy') : 'Not on file'}
          </div>
          <div className="col-span-2">
            <span className="font-semibold">Address:</span> {client.address}
          </div>
          {client.phone && (
            <div>
              <span className="font-semibold">Phone:</span> {client.phone}
            </div>
          )}
        </div>
      </section>

      {/* Rendering Provider Section */}
      <section className="section mb-6 border border-gray-300 p-4">
        <h3 className="section-title font-bold text-sm uppercase border-b border-gray-300 pb-1 mb-3">
          Rendering Provider
        </h3>
        <div className="grid grid-cols-2 gap-x-8 gap-y-2 text-sm">
          <div>
            <span className="font-semibold">Name:</span> {provider.full_name}
            {provider.credentials && `, ${provider.credentials}`}
          </div>
          <div>
            <span className="font-semibold">NPI:</span> {provider.npi || 'Not on file'}
          </div>
          {provider.license_type && provider.license_number && (
            <div>
              <span className="font-semibold">License:</span>{' '}
              {provider.license_type}-{provider.license_number}
            </div>
          )}
        </div>
      </section>

      {/* Diagnoses Section */}
      {diagnoses.length > 0 && (
        <section className="section mb-6 border border-gray-300 p-4">
          <h3 className="section-title font-bold text-sm uppercase border-b border-gray-300 pb-1 mb-3">
            Diagnoses
          </h3>
          <ul className="text-sm space-y-1">
            {diagnoses.map((dx, index) => (
              <li key={index}>
                <span className="font-semibold">{dx.code}</span> - {dx.description}
              </li>
            ))}
          </ul>
        </section>
      )}

      {/* Treatment Objectives Section */}
      {(note.client_primaryobjective || note.client_secondaryobjective || note.client_tertiaryobjective) && (
        <section className="section mb-6 border border-gray-300 p-4">
          <h3 className="section-title font-bold text-sm uppercase border-b border-gray-300 pb-1 mb-3">
            Treatment Objectives
          </h3>
          <div className="text-sm space-y-2">
            {note.client_primaryobjective && (
              <div>
                <span className="font-semibold">Primary:</span> {note.client_primaryobjective}
              </div>
            )}
            {note.client_secondaryobjective && (
              <div>
                <span className="font-semibold">Secondary:</span> {note.client_secondaryobjective}
              </div>
            )}
            {note.client_tertiaryobjective && (
              <div>
                <span className="font-semibold">Tertiary:</span> {note.client_tertiaryobjective}
              </div>
            )}
          </div>
        </section>
      )}

      {/* Mental Status Examination Section */}
      <section className="section mb-6 border border-gray-300 p-4">
        <h3 className="section-title font-bold text-sm uppercase border-b border-gray-300 pb-1 mb-3">
          Mental Status Examination
        </h3>
        <div className="grid grid-cols-2 gap-x-8 gap-y-2 text-sm">
          {note.client_appearance && (
            <div><span className="font-semibold">Appearance:</span> {note.client_appearance}</div>
          )}
          {note.client_attitude && (
            <div><span className="font-semibold">Attitude:</span> {note.client_attitude}</div>
          )}
          {note.client_behavior && (
            <div><span className="font-semibold">Behavior:</span> {note.client_behavior}</div>
          )}
          {note.client_speech && (
            <div><span className="font-semibold">Speech:</span> {note.client_speech}</div>
          )}
          {note.client_affect && (
            <div><span className="font-semibold">Affect:</span> {note.client_affect}</div>
          )}
          {note.client_mood && (
            <div><span className="font-semibold">Mood:</span> {note.client_mood}</div>
          )}
          {note.client_thoughtprocess && (
            <div><span className="font-semibold">Thought Process:</span> {note.client_thoughtprocess}</div>
          )}
          {note.client_perception && (
            <div><span className="font-semibold">Perception:</span> {note.client_perception}</div>
          )}
          {note.client_orientation && (
            <div><span className="font-semibold">Orientation:</span> {note.client_orientation}</div>
          )}
          {note.client_memoryconcentration && (
            <div><span className="font-semibold">Memory/Concentration:</span> {note.client_memoryconcentration}</div>
          )}
          {note.client_insightjudgement && (
            <div><span className="font-semibold">Insight/Judgement:</span> {note.client_insightjudgement}</div>
          )}
        </div>
      </section>

      {/* Risk Assessment Section */}
      <section className="section mb-6 border border-gray-300 p-4">
        <h3 className="section-title font-bold text-sm uppercase border-b border-gray-300 pb-1 mb-3">
          Risk Assessment
        </h3>
        <div className="grid grid-cols-3 gap-x-8 gap-y-2 text-sm">
          <div>
            <span className="font-semibold">Suicidal Ideation:</span>{' '}
            {formatRiskLabel(note.client_suicidalideation)}
          </div>
          <div>
            <span className="font-semibold">Homicidal Ideation:</span>{' '}
            {formatRiskLabel(note.client_homicidalideation)}
          </div>
          <div>
            <span className="font-semibold">Substance Abuse Risk:</span>{' '}
            {formatRiskLabel(note.client_substanceabuserisk)}
          </div>
        </div>
      </section>

      {/* Session Narrative Section */}
      {note.client_sessionnarrative && (
        <section className="section mb-6 border border-gray-300 p-4">
          <h3 className="section-title font-bold text-sm uppercase border-b border-gray-300 pb-1 mb-3">
            Session Narrative
          </h3>
          <p className="text-sm whitespace-pre-wrap">{note.client_sessionnarrative}</p>
        </section>
      )}

      {/* Clinical Assessment Section */}
      {(note.client_functioning || note.client_prognosis || note.client_progress) && (
        <section className="section mb-6 border border-gray-300 p-4">
          <h3 className="section-title font-bold text-sm uppercase border-b border-gray-300 pb-1 mb-3">
            Clinical Assessment
          </h3>
          <div className="grid grid-cols-3 gap-x-8 gap-y-2 text-sm">
            {note.client_functioning && (
              <div><span className="font-semibold">Functioning:</span> {note.client_functioning}</div>
            )}
            {note.client_prognosis && (
              <div><span className="font-semibold">Prognosis:</span> {note.client_prognosis}</div>
            )}
            {note.client_progress && (
              <div><span className="font-semibold">Progress:</span> {note.client_progress}</div>
            )}
          </div>
        </section>
      )}

      {/* Interventions Section */}
      {interventions.length > 0 && (
        <section className="section mb-6 border border-gray-300 p-4">
          <h3 className="section-title font-bold text-sm uppercase border-b border-gray-300 pb-1 mb-3">
            Interventions Utilized
          </h3>
          <ol className="text-sm list-decimal list-inside space-y-1">
            {interventions.map((intervention, index) => (
              <li key={index}>{intervention}</li>
            ))}
          </ol>
        </section>
      )}

      {/* Additional Information Section */}
      {(note.client_personsinattendance || note.client_medications) && (
        <section className="section mb-6 border border-gray-300 p-4">
          <h3 className="section-title font-bold text-sm uppercase border-b border-gray-300 pb-1 mb-3">
            Additional Information
          </h3>
          <div className="text-sm space-y-2">
            {note.client_personsinattendance && (
              <div>
                <span className="font-semibold">Persons in Attendance:</span>{' '}
                {note.client_personsinattendance}
              </div>
            )}
            {note.client_medications && (
              <div>
                <span className="font-semibold">Current Medications:</span>{' '}
                {note.client_medications}
              </div>
            )}
          </div>
        </section>
      )}

      {/* Signature Area */}
      <section className="signature-area mt-12 pt-8">
        <div className="grid grid-cols-2 gap-16">
          <div>
            <div className="border-b border-black h-8 mb-1" />
            <p className="text-sm">
              {provider.full_name}
              {provider.credentials && `, ${provider.credentials}`}
            </p>
            <p className="text-xs text-gray-600">Provider Signature</p>
          </div>
          <div>
            <div className="border-b border-black h-8 mb-1" />
            <p className="text-sm">Date</p>
          </div>
        </div>
      </section>

      {/* Footer */}
      <footer className="mt-12 pt-4 border-t border-gray-300 text-xs text-gray-500 text-center">
        <p>Document generated: {generatedDate}</p>
        <p>This document contains confidential patient health information protected by HIPAA.</p>
      </footer>
    </div>
  );
}

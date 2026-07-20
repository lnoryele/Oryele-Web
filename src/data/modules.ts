export interface Module {
  slug: string;
  icon: string;
  title: string;
  body: string;
  summary: string;
  points: string[];
  outcomes: string[];
  workflow: { step: string; title: string; body: string }[];
  useCases: { title: string; body: string }[];
  controls: string[];
}

export const modules: Module[] = [
  {
    slug: 'digital-workforce', icon: 'person', title: 'Digital Workforce',
    body: 'AI-powered workers that get things done.',
    summary: 'Deploy governed digital workers that take ownership of repeatable work across email, documents, systems, voice, SMS, and calendars while keeping people in control.',
    points: ['Role-based digital workers with defined responsibilities', 'Human review and approval checkpoints', 'Multi-channel work across email, SMS, voice, and calendar', 'Consistent execution using approved policies and playbooks', 'Escalation paths for exceptions and sensitive decisions', 'Complete activity history and measurable performance'],
    outcomes: ['Increase capacity without adding repetitive workload', 'Reduce handoffs and follow-up delays', 'Deliver a more consistent client experience', 'Give teams time back for judgment and relationship work'],
    workflow: [
      {step:'01', title:'Define the role', body:'Set objectives, permissions, boundaries, escalation rules, and the systems the digital worker may use.'},
      {step:'02', title:'Connect the work', body:'Link inboxes, calendars, documents, workflows, and business systems into a governed operating context.'},
      {step:'03', title:'Execute and improve', body:'Monitor performance, review exceptions, and refine instructions using real operational evidence.'}
    ],
    useCases: [
      {title:'Client intake', body:'Collect information, validate completeness, create records, and route work to the right team.'},
      {title:'Follow-up coordination', body:'Send reminders, manage responses, schedule meetings, and escalate stalled items.'},
      {title:'Document operations', body:'Classify, extract, name, file, and route documents according to policy.'},
      {title:'Service delivery support', body:'Prepare updates, summarize status, and keep clients and internal teams aligned.'}
    ],
    controls: ['Least-privilege access', 'Human approval gates', 'Action-level audit trails', 'Policy-based escalation']
  },
  {
    slug: 'workflow-engine', icon: 'workflow', title: 'Workflow Engine',
    body: 'Orchestrate and automate any process across your organization.',
    summary: 'Design, run, and improve end-to-end processes that coordinate people, digital workers, systems, communications, and documents in one accountable execution layer.',
    points: ['Visual process design for multi-step workflows', 'Conditional routing, timers, dependencies, and approvals', 'Reusable templates and standardized operating playbooks', 'Cross-functional assignments and workload visibility', 'Exception queues and automated escalation', 'Version control and detailed execution history'],
    outcomes: ['Standardize delivery across teams', 'Reduce manual coordination and missed steps', 'Shorten cycle time and improve throughput', 'Make ownership and status visible in real time'],
    workflow: [
      {step:'01', title:'Model the process', body:'Translate the real operating process into stages, decisions, owners, deadlines, and evidence requirements.'},
      {step:'02', title:'Automate coordination', body:'Trigger tasks, messages, document requests, approvals, and system actions from a single workflow.'},
      {step:'03', title:'Measure and optimize', body:'Use cycle-time, exception, and completion data to remove bottlenecks and strengthen control.'}
    ],
    useCases: [
      {title:'Onboarding', body:'Coordinate internal teams, clients, documents, approvals, and system setup from a single plan.'},
      {title:'Service delivery', body:'Standardize recurring engagements while allowing controlled variation for client needs.'},
      {title:'Approvals', body:'Route requests according to value, risk, geography, department, or policy.'},
      {title:'Issue resolution', body:'Create accountable remediation paths with owners, deadlines, evidence, and escalation.'}
    ],
    controls: ['Workflow versioning', 'Separation of duties', 'Approval evidence', 'Deadline and exception logs']
  },
  {
    slug: 'communications', icon: 'chat', title: 'Communications',
    body: 'Email, SMS, voice, calendar, and team collaboration.',
    summary: 'Bring operational communications into the process so messages, appointments, decisions, and follow-ups are connected to the work they support.',
    points: ['Unified email, SMS, voice, and calendar orchestration', 'Templates with governed personalization', 'Automatic reminders and response tracking', 'Shared communication history by client or matter', 'Calendar scheduling and appointment workflows', 'Escalation when communications are unanswered'],
    outcomes: ['Reduce inbox-driven operations', 'Improve response rates and client clarity', 'Keep communication history connected to execution', 'Prevent follow-ups from falling through the cracks'],
    workflow: [
      {step:'01', title:'Trigger the right message', body:'Launch communications from workflow events, deadlines, client actions, or business rules.'},
      {step:'02', title:'Track engagement', body:'Capture delivery, response, scheduling, and completion status alongside the underlying work.'},
      {step:'03', title:'Escalate intelligently', body:'Change channel, notify an owner, or create a task when a communication does not achieve its purpose.'}
    ],
    useCases: [
      {title:'Document requests', body:'Send clear requests, reminders, and completion confirmations across preferred channels.'},
      {title:'Appointment management', body:'Coordinate availability, confirmations, changes, and preparation instructions.'},
      {title:'Status updates', body:'Keep clients and stakeholders informed without manual status chasing.'},
      {title:'Internal coordination', body:'Route decisions and handoffs to the right people with shared context.'}
    ],
    controls: ['Approved templates', 'Consent-aware channel rules', 'Message audit history', 'Role-based visibility']
  },
  {
    slug: 'knowledge', icon: 'document', title: 'Knowledge',
    body: 'Smart. Connected. Secure. Always up to date.',
    summary: 'Turn documents, policies, procedures, client information, and institutional expertise into governed knowledge that people and digital workers can use with confidence.',
    points: ['Centralized, searchable organizational knowledge', 'Document ingestion, classification, and OCR', 'Policy and procedure libraries with ownership', 'Context-aware retrieval for people and digital workers', 'Versioning, review dates, and lifecycle controls', 'Permissions down to workspace, matter, and file level'],
    outcomes: ['Find trusted answers faster', 'Reduce dependency on tribal knowledge', 'Improve consistency across teams and locations', 'Keep AI grounded in approved organizational content'],
    workflow: [
      {step:'01', title:'Connect knowledge', body:'Bring together policies, files, templates, records, and approved external sources.'},
      {step:'02', title:'Govern and enrich', body:'Apply ownership, metadata, permissions, review cycles, and relevance signals.'},
      {step:'03', title:'Deliver in context', body:'Surface the right knowledge inside workflows, tasks, client interactions, and digital-worker actions.'}
    ],
    useCases: [
      {title:'Policy guidance', body:'Provide current, approved answers while preserving the source and version used.'},
      {title:'Client and matter context', body:'Assemble relevant records and documents for faster, better-informed action.'},
      {title:'Standard operating procedures', body:'Make the preferred way of working accessible at the moment of execution.'},
      {title:'Institutional continuity', body:'Capture expertise so knowledge survives role changes, growth, and reorganization.'}
    ],
    controls: ['File-level encryption', 'Source attribution', 'Version and review controls', 'Granular permissions']
  },
  {
    slug: 'governance', icon: 'shield', title: 'Governance',
    body: 'Policies, compliance, audit trails, and role-based controls.',
    summary: 'Build security, accountability, compliance, and evidence into daily execution instead of treating governance as a separate after-the-fact exercise.',
    points: ['Role-based access and least-privilege permissions', 'Policy-driven approvals and operating controls', 'Immutable activity and decision histories', 'Legal hold and retention support', 'Exception tracking and remediation workflows', 'Evidence-ready reporting for reviews and audits'],
    outcomes: ['Reduce operational and compliance risk', 'Make accountability visible', 'Accelerate audit and review preparation', 'Apply controls consistently at scale'],
    workflow: [
      {step:'01', title:'Set the rules', body:'Define permissions, approvals, retention, evidence, and escalation requirements.'},
      {step:'02', title:'Enforce in execution', body:'Apply controls automatically as work moves across people, systems, and digital workers.'},
      {step:'03', title:'Prove what happened', body:'Produce reliable histories of actions, decisions, access, exceptions, and remediation.'}
    ],
    useCases: [
      {title:'Access governance', body:'Control who can view, change, approve, export, or share sensitive information.'},
      {title:'Audit readiness', body:'Maintain the evidence needed to demonstrate consistent operation of controls.'},
      {title:'Legal hold', body:'Preserve relevant records and suspend normal disposition according to instruction.'},
      {title:'Policy exceptions', body:'Route exceptions for approval, record rationale, and track corrective action.'}
    ],
    controls: ['RBAC', 'File-level encryption', 'Legal hold', 'Full audit trails']
  },
  {
    slug: 'analytics', icon: 'analytics', title: 'Analytics',
    body: 'Real-time insight that drives performance and results.',
    summary: 'See how work moves, where it slows, what it costs, and which outcomes are being achieved with operational analytics connected directly to execution.',
    points: ['Real-time workload, status, and throughput dashboards', 'Cycle-time and bottleneck analysis', 'Digital-worker and workflow performance metrics', 'SLA, exception, and escalation reporting', 'Outcome and capacity trend analysis', 'Exportable reports for leadership and governance'],
    outcomes: ['Make decisions using live operating evidence', 'Identify bottlenecks before they become client issues', 'Improve capacity planning and accountability', 'Connect activity to business outcomes'],
    workflow: [
      {step:'01', title:'Capture execution data', body:'Record task, workflow, communication, document, and decision events as work happens.'},
      {step:'02', title:'Translate into insight', body:'Organize operational data into useful measures of speed, quality, workload, and outcome.'},
      {step:'03', title:'Act on the signal', body:'Launch interventions, reassign work, adjust processes, and track the impact of changes.'}
    ],
    useCases: [
      {title:'Leadership visibility', body:'Understand performance, risk, demand, and capacity without assembling manual reports.'},
      {title:'Process improvement', body:'Compare cycle time and exceptions across teams, services, and periods.'},
      {title:'Workforce planning', body:'Balance workload using current demand and actual execution patterns.'},
      {title:'Client service performance', body:'Track timeliness, responsiveness, and completion against defined commitments.'}
    ],
    controls: ['Permission-aware reporting', 'Defined metric logic', 'Traceable source events', 'Secure exports']
  }
];

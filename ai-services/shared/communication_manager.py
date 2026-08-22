"""
SwarmAI — Communication Manager

Manages agent-to-agent messages during disaster response orchestration.
Integrates directly with WorkflowService to ensure all agent communication
is persistently logged to MongoDB with incident isolation.
"""

from services.workflow_service import WorkflowService


class CommunicationManager:
    def __init__(self):
        self.messages = []
        self.current_incident_id = None

    def set_incident_id(self, incident_id: str):
        self.current_incident_id = incident_id

    def send_message(
        self,
        sender: str,
        receiver: str,
        message: str,
        incident_id: str = None,
        status: str = "success",
        metadata: dict = None,
    ):
        communication = {
            "from": sender,
            "to": receiver,
            "message": message,
            "status": status,
        }
        self.messages.append(communication)

        target_incident_id = incident_id or self.current_incident_id
        if target_incident_id:
            WorkflowService.record_event(
                incident_id=target_incident_id,
                sender_agent_id=sender,
                receiver_agent_id=receiver,
                event_type="agent_sent_message",
                message=message,
                status=status,
                action="send_message",
                result="acknowledged",
                metadata=metadata or {},
            )

    def get_messages(self):
        return self.messages
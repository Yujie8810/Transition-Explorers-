// A controllable API boundary for provider tests. This does not verify deployed RLS.
module.exports = function circleBackend() {
  return {
    proposals: new Map(), proposalTokens: new Map(),
    invalidateProposals(meeting) {
      for (const proposal of this.proposals.values()) {
        if (proposal.checkInId === meeting.id && proposal.status === 'pending'
          && (proposal.baseRevision !== meeting.revision || ['cancelled', 'declined'].includes(meeting.status))) proposal.status = 'superseded';
      }
    },
    async fetchCheckInTimeProposals(accountId) {
      if (this.failRead) throw new Error('Offline');
      const ids = [...this.checkIns.values()].flat().filter(row => row.senderId === accountId || row.recipientId === accountId).map(row => row.id);
      return [...this.proposals.values()].filter(row => ids.includes(row.checkInId)).map(row => ({ ...row }));
    },
    async proposeCheckInTime(accountId, id, revision, startsAt, durationMinutes, token) {
      if (this.delay) await this.delay;
      if (this.failWrite) throw new Error('Offline');
      const meeting = [...this.checkIns.values()].flat().find(row => row.id === id && row.recipientId === accountId);
      if (!meeting) throw new Error('Only the invited person can propose a new time.');
      const key = `${accountId}:${token}`;
      let proposal = this.proposalTokens.get(key);
      if (proposal) return { ...proposal };
      if (meeting.revision !== revision || meeting.status === 'cancelled') throw new Error('This invitation changed.');
      if ([...this.proposals.values()].some(row => row.checkInId === id && row.status === 'pending')) throw new Error('A proposed time is already awaiting the sender response.');
      proposal = { id: `proposal-${this.proposals.size + 1}`, checkInId: id, proposerId: accountId, baseRevision: revision, startsAt, durationMinutes, status: 'pending' };
      this.proposals.set(proposal.id, proposal); this.proposalTokens.set(key, proposal);
      if (this.loseResponse) { this.loseResponse = false; throw new Error('Response lost'); }
      return { ...proposal };
    },
    async respondToCheckInTimeProposal(accountId, id, decision) {
      if (this.delay) await this.delay;
      if (this.failWrite) throw new Error('Offline');
      const proposal = this.proposals.get(id);
      const meeting = [...this.checkIns.values()].flat().find(row => row.id === proposal?.checkInId && row.senderId === accountId);
      if (!meeting) throw new Error('Only the original sender can respond.');
      if (proposal.status === decision) return { proposal: { ...proposal }, checkIn: { ...meeting } };
      if (proposal.status !== 'pending' || meeting.revision !== proposal.baseRevision || meeting.status === 'cancelled') throw new Error('This proposal changed.');
      if (decision === 'accepted') {
        const start = Date.parse(proposal.startsAt), end = start + proposal.durationMinutes * 60000;
        if ([...this.checkIns.values()].flat().some(other => other.id !== meeting.id && !['cancelled', 'declined'].includes(other.status)
          && ([meeting.senderId, meeting.recipientId].includes(other.senderId)
            || (other.status === 'accepted' && [meeting.senderId, meeting.recipientId].includes(other.recipientId)))
          && start < Date.parse(other.startsAt) + other.durationMinutes * 60000 && end > Date.parse(other.startsAt))) throw new Error('Calendar conflict');
        Object.assign(meeting, { startsAt: proposal.startsAt, durationMinutes: proposal.durationMinutes, revision: meeting.revision + 1, status: 'accepted' });
      }
      proposal.status = decision;
      if (this.loseResponse) { this.loseResponse = false; throw new Error('Response lost'); }
      return { proposal: { ...proposal }, checkIn: { ...meeting } };
    },
    messages: new Map(),
    records: new Map(), requests: new Map(), tokens: new Map(),
    checkIns: new Map(), checkInTokens: new Map(), failCheckInRead: false,
    failRead: false, failWrite: false, loseResponse: false, delay: null,
    async fetchRequestMessages(accountId) {
      if (this.failRead) throw new Error('Offline');
      const ids = [...this.requests.values()].flat().filter(row => row.senderId === accountId || row.recipientId === accountId).map(row => row.id);
      return [...this.messages.values()].filter(row => ids.includes(row.requestId)).map(row => ({ ...row }));
    },
    async sendRequestMessage(accountId, requestId, body, token) {
      if (this.delay) await this.delay;
      if (this.failWrite) throw new Error('Offline');
      const request = [...this.requests.values()].flat().find(row => row.id === requestId && (row.senderId === accountId || row.recipientId === accountId));
      if (!request?.delivered) throw new Error('This conversation is unavailable.');
      const key = `${accountId}:${requestId}:${token}`;
      let message = this.messages.get(key);
      if (message && message.body !== body.trim()) throw new Error('Retry token already used');
      if (!message) {
        message = { id: `message-${this.messages.size + 1}`, requestId, senderId: accountId, body: body.trim(), createdAt: new Date().toISOString() };
        this.messages.set(key, message);
        if (request.recipientId === accountId) Object.assign(request, { status: 'answered', response: message.body, senderHidden: false });
      }
      if (this.loseResponse) { this.loseResponse = false; throw new Error('Response lost'); }
      return { ...message };
    },
    async fetchIncomingCheckIns(accountId) {
      if (this.failRead) throw new Error('Offline');
      return [...this.checkIns.values()].flat().filter(row => row.recipientId === accountId && row.delivered).map(row => ({ ...row }));
    },
    async respondToCheckIn(accountId, id, decision, revision) {
      if (this.delay) await this.delay;
      if (this.failWrite) throw new Error('Offline');
      const row = [...this.checkIns.values()].flat().find(row => row.id === id && row.recipientId === accountId);
      if (!row) throw new Error('This invitation is unavailable.');
      if (row.revision !== revision) throw new Error('The sender changed this invitation.');
      if (row.status === decision) return { ...row };
      if (row.status !== 'pending') throw new Error('This invitation is no longer pending.');
      if (Date.parse(row.startsAt) <= Date.now()) throw new Error('This invitation has expired.');
      if (decision === 'accepted') {
        const start = Date.parse(row.startsAt), end = start + row.durationMinutes * 60000;
        const conflict = [...this.checkIns.values()].flat().some(other => other.id !== id
          && !['cancelled', 'declined'].includes(other.status)
          && (other.senderId === accountId || (other.recipientId === accountId && other.status === 'accepted'))
          && start < Date.parse(other.startsAt) + other.durationMinutes * 60000 && end > Date.parse(other.startsAt));
        if (conflict) throw new Error('You already have a check-in during this time.');
      }
      if (decision === 'accepted' && [...this.proposals.values()].some(row => row.checkInId === id && row.status === 'pending')) throw new Error('Your new time is awaiting the sender response.');
      row.status = decision;
      this.invalidateProposals(row);
      if (this.loseResponse) { this.loseResponse = false; throw new Error('Response lost'); }
      return { ...row };
    },
    async fetchCheckIns(accountId) {
      if (this.failRead || this.failCheckInRead) throw new Error('Offline');
      return (this.checkIns.get(accountId) ?? []).map(row => ({ ...row }));
    },
    async saveRemoteCheckIn(accountId, input, token, id) {
      if (this.delay) await this.delay;
      if (this.failWrite) throw new Error('Offline');
      const rows = this.checkIns.get(accountId) ?? [];
      const key = `${accountId}:${token}`;
      if (!id && this.checkInTokens.has(key)) return { ...this.checkInTokens.get(key) };
      if (id && !rows.some(row => row.id === id)) throw new Error('This check-in no longer exists.');
      if (!(this.records.get(accountId) ?? []).includes(input.guideId)) throw new Error('Add this graduate to your circle first.');
      const start = Date.parse(input.startsAt), end = start + input.durationMinutes * 60000;
      if (rows.some(row => row.id !== id && !['declined', 'cancelled'].includes(row.status) && start < Date.parse(row.startsAt) + row.durationMinutes * 60000
        && end > Date.parse(row.startsAt))) throw new Error('You already have a check-in during this time. Choose another time.');
      const previous = rows.find(row => row.id === id);
      const recipientId = /^[0-9a-f]{8}(-[0-9a-f]{4}){3}-[0-9a-f]{12}$/i.test(input.guideId) ? input.guideId : null;
      const row = { ...input, id: id ?? `check-in-${this.checkInTokens.size + 1}`, senderId: accountId, recipientId,
        delivered: !!recipientId, status: recipientId ? 'pending' : 'personal', revision: previous ? previous.revision + 1 : 1 };
      this.invalidateProposals(row);
      this.checkIns.set(accountId, [...rows.filter(item => item.id !== row.id), row]);
      if (!id) this.checkInTokens.set(key, row);
      if (this.loseResponse) { this.loseResponse = false; throw new Error('Response lost'); }
      return { ...row };
    },
    async cancelRemoteCheckIn(accountId, id) {
      if (this.failWrite) throw new Error('Offline');
      const meeting = (this.checkIns.get(accountId) ?? []).find(row => row.id === id);
      if (meeting) this.invalidateProposals({ ...meeting, status: 'cancelled' });
      this.checkIns.set(accountId, (this.checkIns.get(accountId) ?? []).flatMap(row => row.id !== id ? [row] : row.delivered ? [{ ...row, status: 'cancelled' }] : []));
    },
    async fetchIncomingRequests(accountId) {
      if (this.failRead) throw new Error('Offline');
      return [...this.requests.values()].flat().filter(row => row.recipientId === accountId).map(row => ({ ...row }));
    },
    async respondToGuidanceRequest(accountId, id, decision, response) {
      if (this.delay) await this.delay;
      if (this.failWrite) throw new Error('Offline');
      const row = [...this.requests.values()].flat().find(row => row.id === id && row.recipientId === accountId);
      if (!row) throw new Error('This request is unavailable.');
      if (row.status !== 'pending' && (row.status !== decision || (row.response ?? '') !== response.trim())) {
        throw new Error('This request has already been answered.');
      }
      Object.assign(row, { status: decision, response: response.trim() || null });
      if (this.loseResponse) { this.loseResponse = false; throw new Error('Response lost'); }
      return { ...row };
    },
    async fetchGuidanceRequests(accountId) {
      if (this.failRead) throw new Error('Offline');
      return (this.requests.get(accountId) ?? []).filter(row => !row.senderHidden).map(row => ({ ...row }));
    },
    async saveGuidanceRequest(accountId, request, token) {
      if (this.delay) await this.delay;
      if (this.failWrite) throw new Error('Offline');
      const key = `${accountId}:${token}`;
      let row = this.tokens.get(key);
      if (!row) {
        row = { ...request, id: `request-${this.tokens.size + 1}`, senderId: accountId,
          recipientId: /^[0-9a-f]{8}(-[0-9a-f]{4}){3}-[0-9a-f]{12}$/i.test(request.guideId) ? request.guideId : null,
          delivered: /^[0-9a-f]{8}(-[0-9a-f]{4}){3}-[0-9a-f]{12}$/i.test(request.guideId), status: 'pending' };
        this.requests.set(accountId, [...(this.requests.get(accountId) ?? []), row]);
        this.tokens.set(key, row);
      }
      this.records.set(accountId, [...new Set([...(this.records.get(accountId) ?? []), request.guideId])]);
      if (this.loseResponse) { this.loseResponse = false; throw new Error('Response lost'); }
      return { ...row };
    },
    async dismissGuidanceRequest(accountId, id) {
      if (this.failWrite) throw new Error('Offline');
      const row = (this.requests.get(accountId) ?? []).find(row => row.id === id);
      if (row) row.senderHidden = true;
    },
    async fetchCircleContacts(accountId) {
      if (this.failRead) throw new Error('Offline');
      return [...(this.records.get(accountId) ?? [])];
    },
    async addCircleContact(accountId, guideId) {
      if (this.delay) await this.delay;
      if (this.failWrite) throw new Error('Offline');
      this.records.set(accountId, [...new Set([...(this.records.get(accountId) ?? []), guideId])]);
    },
    async removeCircleContact(accountId, guideId) {
      if (this.failWrite) throw new Error('Offline');
      if ((this.checkIns.get(accountId) ?? []).some(row => !['declined', 'cancelled'].includes(row.status) && row.guideId === guideId
        && Date.parse(row.startsAt) + row.durationMinutes * 60000 > Date.now())) {
        throw new Error('Cancel upcoming check-ins before removing this contact.');
      }
      this.records.set(accountId, (this.records.get(accountId) ?? []).filter(id => id !== guideId));
    },
  };
};

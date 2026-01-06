class LiveSession {
  constructor(store) {
    this._wss = "wss://ws.botcgrimoire.top:443/ws/";
    // this._wss = "ws://localhost:8081/"; // uncomment if using local server with NODE_ENV=development
    this._socket = null;
    this._isSpectator = true;
    this._isAlive = true;
    this._gamestate = [];
    this._store = store;
    this._pingInterval = 3 * 1000; // 30 seconds between pings
    this._pingTimer = null;
    this._sendInterval = 1.5 * 1000; // 1.5 seconds between unsent message cycles
    this._sendTimer = null;
    this._reconnectTimer = null;
    this._players = {}; // map of players connected to a session
    this._pings = {}; // map of player IDs to ping
    // reconnect to previous session
    if (this._store.state.session.sessionId) {
      this.connect(this._store.state.session.sessionId);
    }
  }

  async safeConnect(url) {
    try {
      const httpUrl = 'https://botcgrimoire.top/';
      const response = await fetch(httpUrl, { method: 'HEAD', mode: 'no-cors' });
      return response ? new WebSocket(url) : null;
    } catch (e) {
      return null;
    }
  }

  /**
   * Open a new session for the passed channel.
   * @param channel
   * @private
   */
  async _open(channel) {
    this.disconnect();
    this._socket = await this.safeConnect(
    // this._socket = new WebSocket(
      this._wss +
        channel +
        "/" +
        this._store.state.session.playerId + 
        (!this._isSpectator ? "/host" : "")
    );
    if (this._socket === null) {
      this._store.commit("session/setReconnecting", true);
      this._reconnectTimer = setTimeout(
        () => this.connect(channel),
        3 * 1000
      );
      return;
    }
    this._socket.addEventListener("message", this._handleMessage.bind(this));
    this._socket.onopen = this._onOpen.bind(this);
    this._socket.onclose = err => {
      this._socket = null;
      clearTimeout(this._pingTimer);
      this._pingTimer = null;
      if (err.code !== 1000) {
        // connection interrupted, reconnect after 3 seconds
        this._store.commit("session/setReconnecting", true);
        this._reconnectTimer = setTimeout(
          () => this.connect(channel),
          3 * 1000
        );
      } else {
        // vacate seat upon leaving the room
        this._store.commit("session/claimSeat", -1);
        
        this._store.commit("session/setSessionId", "");
        this._store.commit("session/setSpectator", false);
        this._store.commit("session/setIsHostAllowed", null);
        this._store.commit("session/setIsJoinAllowed", null);
        // clear seats and return to intro
        if (this._store.state.session.nomination) {
          this._store.commit("session/nomination");
        }
        // this._store.commit("players/clear", true);

        // clear customBootlegger
        if (this._store.state.session.bootlegger) {
          this._store.commit("session/setBootlegger", "");
        }

        // reset allowed votes
        if (this._store.state.session.playerVotes > 1) {
          this._store.commit("session/setPlayerVotes", 1);
        }

        // reset secret vote
        if (this._store.state.session.isSecretVote) {
          this._store.commit("session/setSecretVote", false);
        }

        // reset review
        if (this._store.state.session.isReview) {
          this._store.commit("session/setIsReview", false);
        }

        // reset fabled
        this._store.commit("players/setFabled", { fabled: [], emptyFabled: true});

        // close chat box
        this._store.commit("session/setChatOpen", false);

        // exit group chat
        this._store.state.session.groupChats.forEach(group => {
          this._store.commit("session/removeGroupChat", {chatId: group.id});
        });
        
        // clear messages
        while (this._store.state.session.messageQueue.length > 0) {
          this._store.commit("session/deleteMessageQueue", 0);
        }

        // reset wraith
        this._store.commit("session/setIsRole", {
          role: 'wraith',
          property: 'active',
          value: false
        });
        this._store.commit("session/setIsRole", {
          role: 'wraith',
          property: 'using',
          value: false,
          st: true
        });

        if (err.reason) {
          this.showInputModal({
            inputType: "alert",
            inputModal: "text",
            inputData: {
              name: [err.reason],
            }
          }).catch(() => {
            return null;
          });
        }
      }
    };
  }

  /**
   * Send a message through the socket.
   * @param command
   * @param params
   * @private
   */
  _send(command, params, feedback = false) {
    if (this._socket && this._socket.readyState === 1) {
      this._socket.send(JSON.stringify([command, params, feedback]));
    }
  }

  /**
   * Send a message directly to a single playerId, if provided.
   * Otherwise broadcast it.
   * @param playerId player ID or "host", optional
   * @param command
   * @param params
   * @private
   */
  _sendDirect(playerId, command, params, feedback = false) {
    if (playerId) {
      this._send("direct", { [playerId]: [command, params]}, feedback);
    } else {
      this._send(command, params, feedback);
    }
  }
  
  /**
   * Request some server side information.
   * @param playerId player ID or "host"
   * @param command
   * @param params
   * @private
   */
  _request(command, playerId, params, feedback = false) {
    this._send("request", { [command]: [playerId, params] }, feedback);
  }

  /**
   * Upload a file to the server (stored).
   * Currently only supports images for avatar pictures
   * @param playerId player ID or "host"
   * @param command
   * @param params
   * @private
   */
  _uploadFile(command, playerId, params, feedback = false) {
    if (playerId) {
      this._send("uploadFile", { [command]: [playerId, params] }, feedback);
    }
  }

  _sendQueue() {
      if (this._store.state.session.messageQueue.length <= 0) return;
      for (let message of this._store.state.session.messageQueue) {
        switch (message.type) {
          case "direct":
            this._sendDirect(message.playerId, message.command, message.params, message.id);
            break;
          case "request":
            this._request(message.command, message.playerId, message.params, message.id);
            break;
          case "uploadFile":
            this._uploadFile(message.command, message.playerId, message.params, message.id);
            break;
          default:
            this._send(message.command, message.params, message.id);
        }
      }
  }

  _startSendQueue() {
    this._stopSendQueue();
    this._sendQueue();
    this._sendTimer = setInterval(() => {
      this._sendQueue();
    }, this._sendInterval);
  }

  _stopSendQueue() {
    clearInterval(this._sendTimer);
    this._sendTimer = null;
  }

  /**
   * 
   * @param id id for identifying and deleting the query
   */
  _deleteFromQueue(id) {
    if (this._store.state.session.messageQueue.length <= 0) return;
    for (let i=0; i<this._store.state.session.messageQueue.length; i++) {
      if (this._store.state.session.messageQueue[i].id === id) {
        this._checkQueue(this._store.state.session.messageQueue[i]);
        // this._store.state.session.messageQueue.splice(i,1);
        this._store.commit("session/deleteMessageQueue", i)
        break;
      }
    }
  }

  /** 
   * 
   * @param message check the specific message and perform certain actions before deleting
   */
  _checkQueue(message) {
    switch (message.type) {
      case "direct": 
        switch (message.command) {
          case "chat": {
            const receivingPlayerId = message.params.receivingPlayerId === "host" ? this._store.state.session.stId : message.params.receivingPlayerId;
            this._store.commit("session/updateChatReceived", {message: message.params.message, playerId: receivingPlayerId}); // sending out to other players, receivingPlayerId is the recorded chat ID
          }
          break;
        }
        break;
    }
  }

  /**
   * Open event handler for socket.
   * @private
   */
  _onOpen() {
    if (this._isSpectator) {
      this._sendDirect(
        "host",
        "getGamestate",
        this._store.state.session.playerId
      );
      this._sendDirect(
        "host",
        "getStId",
        this._store.state.session.playerId
      )
      this.checkAllowJoin();
      if (this._store.state.session.claimedSeat >= 0 && !this._store.state.session.isListening && !this._store.state.session.isTalking) {
        this._store.commit("session/setTalking", {seatNum: this._store.state.session.claimedSeat, isTalking: false});
      }
    } else {
      if (this._store.state.session.isHostAllowed === true) {
        this.sendGamestate();
      } else {
        this.checkAllowHost();
      }
    }
    this._ping();
  }

  /**
   * Send a ping message with player ID and ST flag.
   * @private
   */
  _ping() {
    this._handlePing();
    this._send("ping", [
      this._isSpectator
        ? this._store.state.session.playerId
        : Object.keys(this._players).length,
      "latency"
    ]);
    clearTimeout(this._pingTimer);
    this._pingTimer = setTimeout(this._ping.bind(this), this._pingInterval);
    // if (this._store.state.session.sessionId && 
    //   !this._isAlive && !this._store.state.session.isReconnecting
    // ) {
    //   this._isAlive = true;
    //   this.connect(this._store.state.session.sessionId);
    // }
    // this._isAlive = false;
  }

  /**
   * Handle an incoming socket message.
   * @param data
   * @private
   */
  _handleMessage({ data }) {
    let command, params, feedback;
    try {
      [command, params, feedback] = JSON.parse(data);
    } catch (err) {
      console.log("unsupported socket message", data);
    }
    switch (command) {
      case "alertPopup":
        this._alertPopup(params);
        break;
      case "allowHost":
        this._handleAllowHost(params);
        break;
      case "allowJoin":
        this._handleAllowJoin(params);
        break;
      case "getGamestate":
        this.sendGamestate(params);
        break;
      case "getStId":
        this.sendStId(params);
        break;
      case "edition":
        this._updateEdition(params);
        break;
      case "states":
        this._updateStates(params);
        break;
      case "teamsNames":
        this._updateTeamsNames(params);
        break;
      case "firstNight":
        this._updateFirstNight(params);
        break;
      case "otherNight":
        this._updateOtherNight(params);
        break;
      case "fabled":
        this._updateFabled(params);
        break;
      case "syncPlayersStatus":
        this._handleSyncPlayerStatus(params);
        break;
      case "gs":
        this._updateGamestate(params);
        break;
      case "stId":
        this._updateStId(params);
        break;
      case "player":
        this._updatePlayer(params);
        break;
      case "bluff":
        this._updateBluff(params);
        break;
      case "grimoire":
        this._updateGrimoire(params);
        break;
      case "claim":
        this._updateSeat(params);
        this._createChatHistory(params);
        break;
      case "leaveSeat":
        this._updateLeaveSeat();
        break;
      case "ping":
        this._handlePing(params);
        break;
      case "pong":
        this._handlePong(params);
        break;
      case "feedback":
        this._deleteFromQueue(params);
        break;
      case "nomination":
        if (!this._isSpectator) return;
        if (!params) {
          // create vote history record
          this._store.commit(
            "session/addHistory",
            this._store.state.players.players
          );
          this._store.commit("session/addVoteSelected", {selected: false, players: this._store.state.players.players, save: true});
        }
        this._store.commit("session/nomination", { nomination: params });
        break;
      case "swap":
        if (!this._isSpectator) return;
        this._store.commit("players/swap", params);
        break;
      case "move":
        if (!this._isSpectator) return;
        this._store.commit("players/move", params);
        break;
      case "remove":
        if (!this._isSpectator) return;
        this._store.commit("players/remove", params);
        break;
      case "marked":
        if (!this._isSpectator) return;
        this._store.commit("session/setMarkedPlayer", params);
        break;
      case "isNight":
        if (!this._isSpectator) return;
        this._store.commit("toggleNight", params);
        break;
      case "isVoteHistoryAllowed":
        if (!this._isSpectator) return;
        this._store.commit("session/setVoteHistoryAllowed", params);
        this._store.commit("session/clearVoteHistory");
        break;
      case "votingSpeed":
        if (!this._isSpectator) return;
        this._store.commit("session/setVotingSpeed", params);
        break;
      case "clearVoteHistory":
        if (!this._isSpectator) return;
        this._store.commit("session/clearVoteHistory");
        break;
      case "isVoteInProgress":
        if (!this._isSpectator) return;
        this._store.commit("session/setVoteInProgress", params);
        break;
      case "vote":
        this._handleVote(params);
        break;
      case "lock":
        this._handleLock(params);
        break;
      case "bye":
        this._handleBye(params);
        break;
      case "pronouns":
        this._updatePlayerPronouns(params);
        break;
      case "isRole":
        this._updateIsRole(params);
        break;
      case "usingRole":
        this._updateUsingRole(params);
        break;
      case "chat":
        this._handleChat(params, feedback);
        break;
      case "addGroupChat":
        this._handleAddGroupChat(params, feedback);
        break;
      case "removeGroupChat":
        this._handleRemoveGroupChat(feedback);
        break;
      case "removeGroupChatMember":
        this._handleRemoveGroupChatMember(params, feedback);
        break;
      case "setTimer":
        this._handleSetTimer(params);
        break;
      case "startTimer":
        this._handleStartTimer(params);
        break;
      case "stopTimer":
        this._handleStopTimer(params);
        break;
      case "avatarReceived":
        this._avatarReceived(params);
        break;
      case "secretVote":
        this._handleSecretVote(params);
        break;
      case "bootlegger":
        this._handleSetBootlegger(params);
        break;
      case "useOldOrder":
        this._handleSetUseOldOrder(params);
        break;
      case "useOldRole":
        this._handleSetUseOldRole(params);
        break;
      case "isReview":
        this._handleSetIsReview(params);
        break;
      case "setTalking":
        this._handleSetTalking(params);
        break;
    }
  }

  /**
   * Connect to a new live session, either as host or spectator.
   * Set a unique playerId if there isn't one yet.
   * @param channel
   */
  async connect(channel) {
    if (!Number(channel) || Number(channel) < 1 || Number(channel) > 10000) {
      this.disconnect();
      this._store.commit("session/setSessionId", "");
      await this._alertPopup("无效的房间号！");
      return;
    }
    if (!this._store.state.session.playerId) {
      let playerId;
      // 禁止host、_host和player作为playerId
      while (!playerId || playerId === "host" || playerId === "_host" || playerId === "player" || playerId === "default") {
        playerId = Math.random().toString(36).substr(2);
      }
      this._store.commit(
        "session/setPlayerId",
        playerId
      );
    }
    this._pings = {};
    this._store.commit("session/setPlayerCount", 0);
    this._store.commit("session/setPing", 0);
    this._isSpectator = this._store.state.session.isSpectator;
    if (this._store.state.session.claimedSeat >= 0) {
      this._store.commit("session/setTalking", {seatNum: this._store.state.session.claimedSeat, isTalking: false});
    }
    this._open(channel);
  }

  /**
   * Close the current session, if any.
   */
  disconnect() {
    this._pings = {};
    this._store.commit("session/setPlayerCount", 0);
    this._store.commit("session/setPing", 0);
    this._store.commit("session/setReconnecting", false);
    clearTimeout(this._reconnectTimer);
    clearTimeout(this._store.state.session.joinTimeout);
    clearTimeout(this._store.state.session.hostTimeout);
    if (this._socket) {
      if (this._isSpectator) {
        this._sendDirect("host", "bye", this._store.state.session.playerId);
      }
      this._socket.close(1000);
      this._socket = null;
    }
  }

  /**
   * Alert any messages from the server
   */
  async _alertPopup(text){
    await this.showInputModal({
      inputType: "alert",
      inputModal: "text",
      inputData: {
        name: [text],
      }
    }).catch(() => {
      return null;
    });
		return;
  }

  async showInputModal({ inputType, inputModal, inputData }) {
    return new Promise((resolve, reject) => {
      this._store.commit("session/setInputResolver", resolve);
      this._store.commit("session/setInputRejecter", reject);

      this._store.commit("session/setInputType", inputType);
      this._store.commit("session/setInputModal", inputModal);
      this._store.commit("session/setInputData", inputData);

      this._store.commit("toggleModal", "input");
    });
  }

  /**
   * Send request to server to check if hosting channel is allowed (no existing hosts).
   */
  async checkAllowHost() {
    if (this._store.state.session.isHostAllowed === true) return;
    this._request("checkAllowHost", this._store.state.session.playerId);
    this._store.state.session.hostTimeout = setTimeout(async () => {
      if (this._store.state.session.isHostAllowed === null) {
        await this.showInputModal({
          inputType: "alert",
          inputModal: "text",
          inputData: {
            name: ["连接失败，请重新进入房间！"],
          }
        }).catch(() => {
          return null;
        });
        this._store.commit("session/setSessionId", "");
        this._store.commit("session/setSpectator", false);
      }
    }, 6000);
  }
  
  /**
   * @param allow indicator to if hosting the channel is allowed
   */
  async _handleAllowHost(allow) {
    if (this._store.state.session.isHostAllowed === true) return;
    clearInterval(this._store.state.session.hostTimeout);
    this._store.state.session.hostTimeout = null;
    this._store.commit("session/setIsHostAllowed", allow ? allow : null);

    if (allow) {
      this.sendGamestate();
    } else {
      await this.showInputModal({
        inputType: "alert",
        inputModal: "text",
        inputData: {
          name: [`房间"${this._store.state.session.sessionId}"已经存在说书人！`],
        }
      }).catch(() => {
        return null;
      });
      this._store.commit("session/setSessionId", "");
      this._store.commit("session/setSpectator", false);
    }
  }

  /**
   * Send request to server to check if joining the channel is allowed (has a host).
   */
  checkAllowJoin() {
    if (this._store.state.session.isJoinAllowed === true) return;
    this._request("checkAllowJoin", this._store.state.session.playerId);
    this._store.state.session.joinTimeout = setTimeout(async () => {
      if (this._store.state.session.isJoinAllowed === null) {
        await this.showInputModal({
          inputType: "alert",
          inputModal: "text",
          inputData: {
            name: ["连接失败，请重新进入房间！"],
          }
        }).catch(() => {
          return null;
        });
        this._store.commit("session/setSessionId", "");
        this._store.commit("session/setSpectator", false);
      }
    }, 1000);
  }

  /**
   * @param allow indicator to if joining the session is allowed
   */
  async _handleAllowJoin(allow) {
    if (this._store.state.session.isJoinAllowed === true) return;
    clearInterval(this._store.state.session.joinTimeout);
    this._store.state.session.joinTimeout = null;
    this._store.commit("session/setIsJoinAllowed", allow ? allow : null);

    if (allow) {
      this._sendDirect(
        "host",
        "getGamestate",
        this._store.state.session.playerId
      );
      this._sendDirect(
        "host",
        "getStId",
        this._store.state.session.playerId
      );
    } else {
      await this.showInputModal({
        inputType: "alert",
        inputModal: "text",
        inputData: {
          name: [`房间"${this._store.state.session.sessionId}"不存在！`],
        }
      }).catch(() => {
        return null;
      });
      this._store.commit("session/setSessionId", "");
      this._store.commit("session/setSpectator", false);
    }
  }

  /**
   * Publish the current gamestate.
   * Optional param to reduce traffic. (send only player data)
   * @param playerId
   * @param isLightweight
   */
  sendGamestate(playerId = "", isLightweight = false) {
    if (this._isSpectator) return;
    this._gamestate = this._store.state.players.players.map(player => ({
      name: player.name,
      id: player.id,
      image: player.image,
      stReminders: this._store.state.session.isReview ? player.stReminders : [],
      isDead: player.isDead,
      isVoteless: player.isVoteless,
      votes: player.votes,
      pronouns: player.pronouns,
      ...(player.role && player.role.team === "traveler"
        ? { roleId: player.role.id }
        : {})
    }));
    if (isLightweight) {
      this._sendDirect(playerId, "gs", {
        gamestate: this._gamestate,
        isLightweight
      });
    } else {
      const { session, grimoire, states, teamsNames, firstNight, otherNight } = this._store.state;
      const { fabled } = this._store.state.players;
      this.sendEdition(playerId);
      let votes = session.nomination ? Array.from(session.votes) : []; // 调整闭眼投票，只会发送各玩家自己的真实投票情况，其余均为不投票
      if (session.isSecretVote && playerId === "") {
        votes = [];
      } else if (session.isSecretVote && votes.length > 0) {
        const playerIndex = this._store.state.players.players.findIndex(player => player.id === playerId);
        for (let i=0; i< votes.length; i++) { // 如果不与playerIndex相同则调整至不投票状态
          if (i != playerIndex && votes[i] === true) votes[i] = false;
        }
      }
      this._sendDirect(playerId, "gs", {
        gamestate: this._gamestate,
        isNight: grimoire.isNight,
        isVoteHistoryAllowed: session.isVoteHistoryAllowed,
        isSecretVote: session.isSecretVote,
        isUseOldOrder: session.isUseOldOrder,
        isUseOldRole: session.isUseOldRole,
        isReview: session.isReview,
        nomination: session.nomination,
        votingSpeed: session.votingSpeed,
        lockedVote: session.lockedVote,
        isVoteInProgress: session.isVoteInProgress,
        markedPlayer: session.isSecretVote ? session.markedPlayer : -1,
        fabled,
        states,
        teamsNames,
        firstNight,
        otherNight,
        ...(session.nomination ? { votes } : {})
      });
    }

    if (this._store.state.session.isReview) {
      this.distributeGrimoire(playerId ? {playerId} : {all: true});
    }
  
    // 场内玩家更新
    const playerIndex = !playerId ? -1 : this._store.state.players.players.findIndex(player => player.id === playerId);
    const groups = {};
    if (!playerId || playerIndex > -1) {
      const selectedPlayers = !playerId ?  this._store.state.players.players.filter(player => !!player.id) : [this._store.state.players.players[playerIndex]];

      // 群聊
      const chatIds = [...new Set(selectedPlayers.map(player => player.chatGroup))];
      const groupChats = this._store.state.session.groupChats.filter(group => chatIds.includes(group.id));
      groupChats.forEach(group => {
        const playerIds = group.players.map(player => player.id);
        groups[group.id] = playerIds;
      });

      selectedPlayers.forEach(player => {
        this._sendDirect(player.id, "syncPlayersStatus", {
          isSecretVoteless: player.isSecretVoteless,
          groupChatPlayers: groups[player.chatGroup] === undefined ? [] : groups[player.chatGroup],
          isWraith: player.isWraith,
          isUsingWraith: player.isUsingWraith
        });
      });
    }
  }

  /**
   * Update the gamestate based on incoming data.
   * @param data
   * @private
   */
  _updateGamestate(data) {
    if (!this._isSpectator) return;
    const {
      gamestate,
      isLightweight,
      isNight,
      isVoteHistoryAllowed,
      isSecretVote,
      isUseOldOrder,
      isUseOldRole,
      isReview,
      nomination,
      votingSpeed,
      votes,
      lockedVote,
      isVoteInProgress,
      markedPlayer,
      fabled,
      states,
      teamsNames,
      firstNight,
      otherNight
    } = data;
    const players = this._store.state.players.players;
    // adjust number of players
    if (players.length < gamestate.length) {
      for (let x = players.length; x < gamestate.length; x++) {
        this._store.commit("players/add", gamestate[x].name);
      }
    } else if (players.length > gamestate.length) {
      for (let x = players.length; x > gamestate.length; x--) {
        this._store.commit("players/remove", x - 1);
      }
    }
    // update status for each player
    gamestate.forEach((state, x) => {
      const player = players[x];
      const { roleId } = state;
      // update relevant properties
      ["name", "id", "image", "stReminders", "isDead", "isSecretVoteless", "isVoteless", "pronouns", "votes"].forEach(property => {
        const value = state[property];
        if (player[property] !== value) {
          if (property === "isVoteless") {
            if (value || !player.isSecretVoteless) this._store.commit("players/update", { player, property, value });
          } else {
            this._store.commit("players/update", { player, property, value });
          }
        }
      });
      // roles are special, because of travelers
      if (roleId && player.role.id !== roleId) {
        const role =
          this._store.state.roles.get(roleId) ||
          this._store.getters.rolesJSONbyId.get(roleId);
        if (role) {
          this._store.commit("players/update", {
            player,
            property: "role",
            value: role
          });
        }
      } else if (!roleId && player.role.team === "traveler") {
        this._store.commit("players/update", {
          player,
          property: "role",
          value: {}
        });
      }
    });
    if (!isLightweight) {
      this._store.commit("toggleNight", !!isNight);
      this._store.commit("session/setVoteHistoryAllowed", isVoteHistoryAllowed);
      this._store.commit("session/setSecretVote", isSecretVote);
      this._store.commit("session/setUseOldOrder", isUseOldOrder);
      this._store.commit("session/setUseOldRole", isUseOldRole);
      this._store.commit("session/setIsReview", isReview);
      const nominatedPlayer = nomination.length ? players[nomination[1]] : null;
      this._store.commit("session/nomination", {
        nomination,
        votes,
        votingSpeed,
        lockedVote,
        isVoteInProgress,
        nominatedPlayer
      });
      this._store.commit("session/setMarkedPlayer", {val: markedPlayer, force: false});
      this._store.commit("players/setFabled", {fabled});
      this._store.commit("setStates", states);
      this._store.commit("setTeamsNames", teamsNames);
      this._store.commit("setFirstNight", firstNight);
      this._store.commit("setOtherNight", otherNight);
    }
  }

  sendStId(playerId = "") {
    if (this._isSpectator) return;
    this._sendDirect(playerId, "stId", this._store.state.session.playerId)
  }

  _updateStId(data) {
    if (!this._isSpectator) return;
    // this._store.state.session.stId = data;
    this._store.commit("session/setStId", data);
  }

  /**
   * Publish an edition update. ST only
   * @param playerId
   */
  sendEdition(playerId = "") {
    if (this._isSpectator) return;
    const { edition } = this._store.state;
    let roles;
    if (!edition.isOfficial) {
      roles = this._store.getters.customRolesStripped;
    }
    this._sendDirect(playerId, "edition", {
      edition: edition.isOfficial ? { id: edition.id } : edition,
      ...(roles ? { roles } : {})
    });
  }

  /**
   * Update edition and roles for custom editions.
   * @param edition
   * @param roles
   * @private
   */
  async _updateEdition({ edition, roles }) {
    if (!this._isSpectator) return;
    this._store.commit("setEdition", edition);
    if (roles) {
      this._store.commit("setCustomRoles", roles);
      if (this._store.state.roles.size !== roles.length) {
        const missing = [];
        roles.forEach(({ id }) => {
          if (!this._store.state.roles.get(id)) {
            missing.push(id);
          }
        });
        await this.showInputModal({
          inputType: "alert",
          inputModal: "text",
          inputData: {
            name: [
                    `此剧本中有未收录的角色。` + 
                    `请先加载这些角色！` + 
                    `这些角色包含：${missing.join("，")}`
                  ],
          }
        }).catch(() => {
          return null;
        });
        this.disconnect();
        this._store.commit("toggleModal", "edition");
      }
    }
  }

  /**
   * Publish a states update. ST only
   * @param playerId
   */
  sendStates(playerId = "") {
    if (this._isSpectator) return;
    const { states } = this._store.state;
    this._sendDirect(playerId, "states", states);
  }


  /**
   * Update states for custom editions.
   * @param states
   * @private
   */
  _updateStates(states) {
    if (!this._isSpectator) return;
    this._store.commit("setStates", states);
  }


  /**
   * Publish a teams alias update. ST only
   * @param playerId
   */
  sendTeamsNames(playerId = "") {
    if (this._isSpectator) return;
    const { teamsNames } = this._store.state;
    this._sendDirect(playerId, "teamsNames", teamsNames);
  }

  /**
   * Update teamsNames for custom editions.
   * @param teamsNames
   * @private
   */
  _updateTeamsNames(teamsNames) {
    if (!this._isSpectator) return;
    this._store.commit("setTeamsNames", teamsNames);
  }

  /**
   * Publish a firstNight update. ST only
   * @param playerId
   */
  sendFirstNight(playerId = "") {
    if (this._isSpectator) return;
    const { firstNight } = this._store.state;
    this._sendDirect(playerId, "firstNight", firstNight);
  }

  /**
   * Update firstNight.
   * @param firstNight
   * @private
   */
  _updateFirstNight(firstNight) {
    if (!this._isSpectator) return;
    this._store.commit("setFirstNight", firstNight);
  }

  /**
   * Publish an otherNight update. ST only
   * @param playerId
   */
  sendOtherNight(playerId = "") {
    if (this._isSpectator) return;
    const { otherNight } = this._store.state;
    this._sendDirect(playerId, "otherNight", otherNight);
  }

  /**
   * Update otherNight.
   * @param otherNight
   * @private
   */
  _updateOtherNight(otherNight) {
    if (!this._isSpectator) return;
    this._store.commit("setOtherNight", otherNight);
  }

  /**
   * Publish a fabled update. ST only
   */
  sendFabled() {
    if (this._isSpectator) return;
    const { fabled } = this._store.state.players;
    this._send(
      "fabled",
      fabled
    );
  }

  /**
   * Update fabled roles.
   * @param fabled
   * @private
   */
  _updateFabled(fabled) {
    if (!this._isSpectator) return;
    this._store.commit("players/setFabled", {
      fabled
    });
  }

  /**
   * Publish a player update.
   * @param player
   * @param property
   * @param value
   */
  sendPlayer({ player, property, value }) {
    if (this._isSpectator || property === "reminders" || (property === "stReminders" && !this._store.state.session.isReview)) return;
    const index = this._store.state.players.players.indexOf(player);
    const staticProperties = ['isAllowRole'];
    if (property === "role") {
      if (this._store.state.session.isReview || value.team && value.team === "traveler") {
        // update local gamestate to remember this player as a traveler
        if (value.team && value.team === "traveler" && this._gamestate[index]) this._gamestate[index].roleId = value.id;
        this._send("player", {
          index,
          property,
          value: value.id
        });
        if (this._store.state.session.isReview && value.team != "traveler" && this._gamestate[index] && this._gamestate[index].roleId) delete this._gamestate[index].roleId;
      } else if (this._gamestate[index] && this._gamestate[index].roleId) {
        // player was previously a traveler
        delete this._gamestate[index].roleId;
        this._send("player", { index, property, value: "" });
      }
    } else if (property === "isSecretVoteless") {
      this._sendDirect(player.id, "player", { index, property, value });
    } else if (property === "isWraith") {
      this._sendDirect(player.id, "isRole", {role: 'wraith', property: 'active', value});
    } else if (property === 'isUsingWraith') {
      this._sendDirect(player.id, "isRole", {role: 'wraith', property: 'using', value, st: true});
    } else if (!staticProperties.includes(property)) {
      this._send("player", { index, property, value });
    }
  }

  /**
   * Update a player based on incoming data. Player only.
   * @param index
   * @param property
   * @param value
   * @private
   */
  _updatePlayer({ index, property, value }) {
    if (!this._isSpectator) return;
    const player = this._store.state.players.players[index];
    if (!player) return;
    // special case where a player stops being a traveler
    if (property === "role") {
      if (!value && player.role.team === "traveler") {
        // reset to an unknown role
        this._store.commit("players/update", {
          player,
          property: "role",
          value: {}
        });
      } else {
        // load role, first from session, the global, then fail gracefully
        const role =
          this._store.state.roles.get(value) ||
          this._store.getters.rolesJSONbyId.get(value) ||
          {};
        this._store.commit("players/update", {
          player,
          property: "role",
          value: role
        });
      }
    } else if (property === "isSecretVoteless") {
      // if (value === true) {
        this._store.commit("players/update", { player, property, value });
        // 如果是玩家则同时移除投票标记
        if (player.id === this._store.state.session.playerId && value) {
          this._store.commit("players/update", { player, property: 'isVoteless', value });
        }
      // }
    } else if (property === "isVoteless") {
      if (!player.isSecretVoteless || value) this._store.commit("players/update", { player, property, value });
    } else {
      // just update the player otherwise
      this._store.commit("players/update", { player, property, value });
    }
  }

  emptyPlayer({id}) {
    if (id === "") return; //必须指定玩家
    this._sendDirect(id, "leaveSeat")
  }

  _updateLeaveSeat() {
    this._store.state.session.claimedSeat = -1;
  }

  /**
   * Publish a player pronouns update
   * @param player
   * @param value
   * @param isFromSockets
   */
  sendPlayerPronouns({ player, value, isFromSockets }) {
    //send pronoun only for the seated player or storyteller
    //Do not re-send pronoun data for an update that was recieved from the sockets layer
    if (
      isFromSockets ||
      (this._isSpectator && this._store.state.session.playerId !== player.id)
    )
      return;
    const index = this._store.state.players.players.indexOf(player);
    this._send("pronouns", [index, value]);
  }

  /**
   * Update a pronouns based on incoming data.
   * @param index
   * @param value
   * @private
   */
  _updatePlayerPronouns([index, value]) {
    const player = this._store.state.players.players[index];

    this._store.commit("players/update", {
      player,
      property: "pronouns",
      value,
      isFromSockets: true
    });
  }

  /**
   * Update a role using status, player only.
   * @param role role to be updated
   * @param property property in the role set to be 
   * @param value value to be updated
   */
  setIsRole({role, property, value, st}) {
    if (st === true) return;
    if (!this._isSpectator) return;
    if (property !== 'using') return;
    if (!this._store.state.session.isRole[role]) return;
    this._sendDirect("host", "usingRole", {role, value, playerId: this._store.state.session.playerId});
  }
  
  /**
   * Update a role status.
   * @param role role to be updated
   * @param property property in the role set to be updated
   * @param value value to be updated
   */
  _updateIsRole({role, property, value, st}) {
    if (!this._isSpectator && property !== 'using') return;
    if (this._isSpectator && property === 'using' && !st) return;
    this._store.commit("session/setIsRole", {role, property, value, st});
  }

  /**
   * Update a role status.
   * @param role role to be updated
   * @param property property in the role set to be updated
   * @param value value to be updated
   */
  _updateUsingRole({role, value, playerId}) {
    if (this._isSpectator) return;
    const index = this._store.state.players.players.findIndex(player => player.id === playerId);
    if (index === -1) return;
    const player = this._store.state.players.players[index];
    if (role === 'wraith') {
      if (player.isWraith) {
        this._store.commit("players/update", {
          player,
          property: 'isUsingWraith',
          value
        });
      } else {
        this._store.commit("players/update", {
          player,
          property: 'isWraith',
          value: false
        });
        this._store.commit("players/update", {
          player,
          property: 'isUsingWraith',
          value: false
        });
      }
    }
  }

  /**
   * Upload avatar image to the server and create a link.
   * @param image
   */
  uploadAvatar(image) {
    this._uploadFile("uploadAvatar", this._store.state.session.playerId, image);
  }
  
  /**
   * Confirmation on receiving the uploaded image.
   * @param image
   */
  async _avatarReceived(link) {
    const playerId = this._store.state.session.playerId;
    const linkId = link.split(".")[0];
    if (playerId != linkId) return;

    this._store.commit("session/updatePlayerAvatar", link);
    await this.showInputModal({
      inputType: "alert",
      inputModal: "text",
      inputData: {
        name: ["头像上传成功！"],
      }
    }).catch(() => {
      return null;
    });
		return;
  }

  /**
   * Handle a ping message by another player / storyteller
   * @param playerIdOrCount
   * @param latency
   * @private
   */
  _handlePing([playerIdOrCount = 0, latency] = []) {
    const now = new Date().getTime();
    // if (!this._players.length) return;
    if (!this._isSpectator) {
      // store new player data
      if (playerIdOrCount) {
        this._players[playerIdOrCount] = now;
        const ping = parseInt(latency, 10);
        if (ping && ping > 0 && ping < 30 * 1000) {
          // ping to Players
          this._pings[playerIdOrCount] = ping;
          const pings = Object.values(this._pings);
          this._store.commit(
            "session/setPing",
            Math.round(pings.reduce((a, b) => a + b, 0) / pings.length)
          );
        }
      }
    } else if (latency) {
      // ping to ST
      this._store.commit("session/setPing", parseInt(latency, 10));
    }
    // update player count
    if (!this._isSpectator || playerIdOrCount) {
      this._store.commit(
        "session/setPlayerCount",
        this._isSpectator ? playerIdOrCount : Object.keys(this._players).length
      );
    }
  }

  _handlePong() {
    this._isAlive = true;
  }

  /**
   * Handle a player leaving the sessions. ST only
   * @param playerId
   * @private
   */
  _handleBye(playerId) {
    if (this._isSpectator) return;
    delete this._players[playerId];
    this._store.commit(
      "session/setPlayerCount",
      Object.keys(this._players).length
    );
  }

  /**
   * Claim a seat, needs to be confirmed by the Storyteller.
   * Seats already occupied can't be claimed.
   * @param seat either -1 to vacate or the index of the seat claimed
   */
  claimSeat(seat) {
    if (!this._isSpectator) return;
    const players = this._store.state.players.players;
    if (players.length > seat && (seat < 0 || !players[seat].id)) {
      // this._send("claim", [seat, this._store.state.session.playerId, this._store.state.session.playerName, this._store.state.session.playerAvatar]);
      this._sendDirect("host", "claim", [seat, this._store.state.session.playerId, this._store.state.session.playerName, this._store.state.session.playerAvatar]);
    }
  }

  /**
   * Update a player id associated with that seat.
   * @param index seat index or -1
   * @param value playerId to add / remove
   * @private
   */
  _updateSeat([index, value, name, image]) {
    // index is the seat number, value is the playerId, name is the playerName
    if (this._isSpectator) return;
    // const property = "id";
    const players = this._store.state.players.players;
    if (index >= 0 && players[index].id) return;
    // remove previous seat
    const oldIndex = players.findIndex(({ id }) => id === value);
    if (oldIndex >= 0 && oldIndex !== index) {
      if (players[oldIndex].chatGroup != "") {
        const player = players[oldIndex];
        const chatId = player.chatGroup;
        this._store.commit("session/removeGroupChatMember", {chatId, player});
      }
      this._store.commit("players/update", {
        player: players[oldIndex],
        property: "id",
        value: ""
      });
      // this._store.commit("players/update", {
      //   player: players[oldIndex],
      //   property: "name",
      //   value: ""
      // });
      // this._store.commit("players/update", {
      //   player: players[oldIndex],
      //   property: "image",
      //   value: ""
      // });
      if (players[oldIndex].isTalking === true) {
        this._store.commit("players/update", {
          player: players[oldIndex],
          property: "isTalking",
          value: false
        });
      }
      if (players[oldIndex].isWraith === true) {
        this._store.commit("players/update", {
          player: players[oldIndex],
          property: "isWraith",
          value: false
        });
      }
      if (players[oldIndex].isUsingWraith === true) {
        this._store.commit("players/update", {
          player: players[oldIndex],
          property: "isUsingWraith",
          value: false
        });
      }
      if (players[oldIndex].isAllowRole === false) {
        this._store.commit("players/update", {
          player: players[oldIndex],
          property: "isAllowRole",
          value: true
        });
      }
    }
    // add playerId to new seat
    if (index >= 0) {
      const player = players[index];
      if (!player) return;
      this._store.commit("players/update", { player, property: "image", value: image });
      this._store.commit("players/update", { player, property:"name", value: name});
      this._store.commit("players/update", { player, property: "id", value });
    }
    // update player session list as if this was a ping
    this._handlePing([true, value, 0]);
  }


  /**
   * Create a chat history for a playerID.
   * @param index seat index (only created when seat claimed but not removed)
   * @param value playerId to add
   * @private
   */
  _createChatHistory([index]) {
    if (index < 0) return;
    const playerId = (this._store.state.players.players[index]).id;
    if (playerId === "") return;
    if (this._store.state.session.chatHistory[playerId] != undefined) return;
    if (this._isSpectator && this._store.state.session.playerId != playerId) return;
    this._store.commit("session/createChatHistory", playerId );
  }

  /**
   * Distribute player roles to all seated players in a direct message.
   * This will be split server side so that each player only receives their own (sub)message.
   */
  distributeRoles() {
    if (this._isSpectator) return;
    const message = {};
    this._store.state.players.players.forEach((player, index) => {
      if (player.id && player.role) {
        message[player.id] = [
          "player",
          { index, property: "role", value: player.role.id }
        ];
      }
    });
    if (Object.keys(message).length) {
      this._send("direct", message);
    }
  }

  /**
   * Distribute player types to all seated players in a direct message.
   * This will be split server side so that each player only receives their own (sub)message.
   */
  distributeTypes() {
    if (this._isSpectator) return;
    const message = {};
    this._store.state.players.players.forEach((player, index) => {
      if (player.id && player.role) {
        message[player.id] = [
          "player",
          { index, property: "role", value: player.role.team === "traveler" ? player.role.id : player.role.team + 's' } //角色类型图标均有s后缀
        ];
      }
    });
    if (Object.keys(message).length) {
      this._send("direct", message);
    }
  }

  /**
   * Distribute bluffs to demon, lunatic, minion players.
   * This will be split server side so that each player only receives their own (sub)message.
   * @param all is the boolean indicator if sending bluffs to everyone
   * @param role is the role being sent a bluffs
   * @param seatNum is the seat number being sent a bluffs
   * @param playerId is the playerId being sent a bluffs, may or may not be seated.
   */
  distributeBluffs({all, role, seatNum, playerId}) {
    if (this._isSpectator) return;
    if (!all && !seatNum && !playerId && !role) return;

    if (all) {
      this._send("bluff", this._store.state.players.bluffs);
      return;
    }
    if (playerId) {
      this._sendDirect(playerId, "bluff", this._store.state.players.bluffs);
      return;
    }
    if (seatNum) {
      playerId = this._store.state.players.players[seatNum-1].id;
      this._sendDirect(playerId, "bluff", this._store.state.players.bluffs);
      return;
    }

    let team;
    switch (role) {
      case "demon":
      case "lunatic":
      case "demonAll":
        team = "demon";
        break;
      case "snitch":
      case "widow":
      case "spy":
        team = "minion";
        break;
    }

    const message = {};
    this._store.state.players.players.forEach(player => {
      if (player.id && player.role && player.role.team == team) {
        if (team === "demon"){
          let lunatic = false;
          player.reminders.forEach(reminder => {
            if (reminder.role === "lunatic") {
              lunatic = true;
              return;
            }
          })
          if ((role === "lunatic" && !lunatic) || (role === "demon" && lunatic)) return;
        } else if ((role === "widow" || role === "spy") && player.role.id != role) return; 
        message[player.id] = [
          "bluff",
          this._store.state.players.bluffs
        ];
      }
    });
    if (Object.keys(message).length) {
      this._send("direct", message);
    }
  }

  /**
   * Update demon bluffs based on incoming data. Demon/Luantic only.
   * @param bluffs
   */
  _updateBluff(bluffs) {
    if (!this._isSpectator) return;
    this._store.commit("players/updateBluff", bluffs);
  }

  /**
   * Distribute grimoire to designated players.
   * Takes one of the arguments, everything else will be null.
   * role, seatNum, playerId in a direct message.
   * This will be split server side so that each player only receives their own (sub)message.
   * @param all is the boolean indicator if sending grimoire to everyone
   * @param role is the role being sent a grimoire
   * @param seatNum is the seat number being sent a grimoire
   * @param playerId is the playerId being sent a grimoire, may or may not be seated.
   */
  distributeGrimoire({all, role, seatNum, playerId}) {
    if (this._isSpectator) return;
    if (!all && !seatNum && !playerId && !role) return;

    const fullGrimoire = (!!all || !!playerId) ? false : true;

    const message = {};
    if (!role) { // not specifying a role
      message.roles = [];
      if (fullGrimoire) {
        message.reminders = [];
      }
      if (all) {
        message.stReminders = [];
      }
      this._store.state.players.players.forEach((player, index) => {
        message.roles.push([
          { index, property: "role", value: player.role.id }
        ]);
        if (fullGrimoire) {
          message.reminders.push([
            { index, property: "reminder", value: player.reminders }
          ]);
        }
        if (all) {
          message.stReminders.push([
            { index, property: "stReminder", value: player.stReminders }
          ]);
        }
      });
      if (Object.keys(message.roles).length) {
        if (all) this._send("grimoire", message);
        if (playerId) this._sendDirect(playerId, "grimoire", message);
        if (seatNum) {
          playerId = this._store.state.players.players[seatNum-1].id;
          this._sendDirect(playerId, "grimoire", message);
        }
      }
    } else {
      // send all roles and reminders when requesting full grimoire (i.e. widow or spy)
      this._store.state.players.players.forEach((player) => {
        if (player.id && player.role && player.role.id == role) {
          message[player.id] = ["grimoire", {roles: [], reminders: []}];
          this._store.state.players.players.forEach((player2, index) => {
            message[player.id][1].roles.push([
              { index, property: "role", value: player2.role.id }
            ]);
            if (fullGrimoire) {
              message[player.id][1].reminders.push([
                { index, property: "reminder", value: player2.reminders }
              ]);
            }
          });
        }
      });
      if (Object.keys(message).length) {
        this._send("direct", message);
      }
    }

    // send bluffs
    this.distributeBluffs({all, role, seatNum, playerId});
  }

  /**
   * Update grimoire once received
   * @param payload is the grimoire details.
   */
  _updateGrimoire(payload){
    // set roles
    payload.roles.forEach(grimRole => {
      // load role, first from session, the global, then fail gracefully
      const role =
        this._store.state.roles.get(grimRole[0].value) ||
        this._store.getters.rolesJSONbyId.get(grimRole[0].value) ||
        {};
      if (role.team === "traveler") return;
      const player = this._store.state.players.players[grimRole[0].index];
      this._store.commit("players/update", {
        player,
        property: "role",
        value: role
      });
    })
    
    // set reminders
    if (payload.reminders) {
      payload.reminders.forEach(grimReminder => {
        if (!grimReminder[0].value.length) return
        const player = this._store.state.players.players[grimReminder[0].index];
        const value = Array.from(player.reminders);
        grimReminder[0].value.forEach(reminder => {
          if (reminder.role === "custom") return;
          value.push(reminder);
        });
        this._store.commit("players/update", {
          player,
          property: "reminders",
          value
        });
      })
    }
    // set stReminders
    if (payload.stReminders) {
      payload.stReminders.forEach(grimReminder => {
        if (!grimReminder[0].value.length) return
        const player = this._store.state.players.players[grimReminder[0].index];
        this._store.commit("players/update", {
          player,
          property: "stReminders",
          value: grimReminder[0].value
        });
      })
    }
  }

  /**
   * A player nomination. ST only
   * This also syncs the voting speed to the players.
   * Payload can be an object with {nomination} property or just the nomination itself, or undefined.
   * @param payload [nominator, nominee]|{nomination}
   */
  nomination(payload) {
    if (this._isSpectator) return;
    const nomination = payload ? payload.nomination || payload : payload;
    const players = this._store.state.players.players;
    if (
      !nomination ||
      (players.length > nomination[0] && players.length > nomination[1])
    ) {
      this.setVotingSpeed(this._store.state.session.votingSpeed);
      this._send("nomination", nomination);
    }
  }

  /**
   * Set the isVoteInProgress status. ST only
   */
  setVoteInProgress() {
    if (this._isSpectator) return;
    this._send("isVoteInProgress", this._store.state.session.isVoteInProgress);
  }

  /**
   * Send the isNight status. ST only
   */
  setIsNight() {
    if (this._isSpectator) return;
    this._send("isNight", this._store.state.grimoire.isNight);
  }

  /**
   * Send the isVoteHistoryAllowed state. ST only
   */
  setVoteHistoryAllowed() {
    if (this._isSpectator) return;
    this._send(
      "isVoteHistoryAllowed",
      this._store.state.session.isVoteHistoryAllowed
    );
  }

  /**
   * Send the voting speed. ST only
   * @param votingSpeed voting speed in seconds, minimum 1
   */
  setVotingSpeed(votingSpeed) {
    if (this._isSpectator) return;
    if (votingSpeed) {
      this._send("votingSpeed", votingSpeed);
    }
  }

  /**
   * Set which player is on the block. ST only
   * @param playerIndex, player id or -1 for empty
   */
  setMarked(playerIndex) {
    if (this._isSpectator) return;
    if (this._store.state.session.isSecretVote) return;
    this._send("marked", playerIndex);
  }

  /**
   * Clear the vote history for everyone. ST only
   */
  clearVoteHistory() {
    if (this._isSpectator) return;
    this._send("clearVoteHistory");
  }

  /**
   * Send a vote. Player or ST
   * @param index Seat of the player
   * @param sync Flag whether to sync this vote with others or not
   */
  vote([index]) {
    const player = this._store.state.players.players[index];
    if (
      this._store.state.session.playerId === player.id ||
      !this._isSpectator
    ) {
      if (
        this._store.state.players.players[this._store.state.session.nomination[1]].role.team === "traveler" ||
        !this._store.state.session.isSecretVote
      ) { // send to everyone if exile or secret vote is off
        // send vote only if it is your own vote or you are the storyteller
        this._send("vote", [
          index,
          this._store.state.session.votes[index],
          !this._isSpectator
        ]);
      } else { // otherwise only send direct messages
        if (this._isSpectator) {
          this._sendDirect("host", "vote", [
            index,
            this._store.state.session.votes[index],
            !this._isSpectator
          ])
        } else {
          this._sendDirect(player.id, "vote", [
            index,
            this._store.state.session.votes[index],
            !this._isSpectator
          ])
        }
      }
    }
  }

  /**
   * Send a status change to whether anonymous votes are in progress. ST to players only
   */
  setSecretVote(isSecretVote){
    if (this._isSpectator) return;
    this._send("secretVote", isSecretVote);
  }

  _handleSecretVote(isSecretVote){
    if (!this._isSpectator) return;
    this._store.state.session.isSecretVote = isSecretVote;
  }

  setBootlegger(content){
    if (this._isSpectator) return;
    this._send("bootlegger", content);
  }

  _handleSetBootlegger(content){
    if (!this._isSpectator) return;
    this._store.state.session.bootlegger = content;
  }

  setUseOldOrder(isUseOldOrder){
    if (this._isSpectator) return;
    this._send("useOldOrder", isUseOldOrder);
  }

  _handleSetUseOldOrder(isUseOldOrder){
    if (!this._isSpectator) return;
    this._store.state.session.isUseOldOrder = isUseOldOrder;
  }

  setUseOldRole(isUseOldRole){
    if (this._isSpectator) return;
    this._send("useOldRole", isUseOldRole);
  }

  _handleSetUseOldRole(isUseOldRole){
    if (!this._isSpectator) return;
    this._store.state.session.isUseOldRole = isUseOldRole;
  }

  setIsReview(isReview){
    if (this._isSpectator) return;
    this._send("isReview", isReview);
  }

  _handleSetIsReview(isReview){
    if (!this._isSpectator) return;
    this._store.state.session.isReview = isReview;
    if (!isReview) {
      this._store.state.players.players.forEach(player => {
        this._store.commit("players/update", {
          player,
          property: "stReminders",
          value: []
        });
      });
    }
  }

  /**
   * Set talking status to true to enable glowing animation
   * Send this update to all clients in the channel
   */
  setTalking(payload){
    if (payload.seatNum < 0 || payload.seatNum >= this._store.state.players.players.length) return;
    if (!this._store.state.players.players[payload.seatNum].id || this._store.state.players.players[payload.seatNum].id != this._store.state.session.playerId) return;
    this._send("setTalking", payload);
  }

  /**
   * Set talking status to true to enable glowing animation when received
   */
  _handleSetTalking(payload){
    if (payload.seatNum < 0 || payload.seatNum >= this._store.state.players.players.length) return;
    this._store.state.players.players[payload.seatNum].isTalking = payload.isTalking;
  }

  /**
   * Handle an incoming vote, but only if it is from ST or unlocked.
   * @param index
   * @param vote
   * @param fromST
   */
  _handleVote([index, vote, fromST]) {
    // do not reveal vote when anonymous voting is in progress, unless it's ST changing that player's vote
    const voteId = this._store.state.players.players[index].id;
    if (
      this._isSpectator && voteId != this._store.state.session.playerId && 
      this._store.state.session.isSecretVote && this._store.state.players.players[this._store.state.session.nomination[1]].role.team != "traveler"
    ) return;
    
    const { session, players } = this._store.state;
    const playerCount = players.players.length;
    const indexAdjusted =
      (index - 1 + playerCount - session.nomination[1]) % playerCount;
    if (fromST || indexAdjusted >= session.lockedVote - 1) {
      this._store.commit("session/vote", [index, vote]);
    }
  }

  /**
   * Lock a vote. ST only
   */
  lockVote() {
    if (this._isSpectator) return;
    const { lockedVote, votes, nomination } = this._store.state.session;
    const { players } = this._store.state.players;
    const index = (nomination[1] + lockedVote - 1) % players.length;
    this._send("lock", [this._store.state.session.lockedVote, votes[index]]);
  }

  /**
   * Update vote lock and the locked vote, if it differs. Player only
   * @param lock
   * @param vote
   * @private
   */
  _handleLock([lock, vote]) {
    if (!this._isSpectator) return;
    this._store.commit("session/lockVote", lock);
    
    if (lock > 1) {
      const { lockedVote, nomination } = this._store.state.session;
      const { players } = this._store.state.players;
      const index = (nomination[1] + lockedVote - 1) % players.length;
      // record as not voted when anonymous voting is in progress
      const displayVote = this._store.state.session.isSecretVote ? false : vote;
      if (this._store.state.session.votes[index] !== vote) {
        this._store.commit("session/vote", [index, displayVote]);
      }
    }
  }

  /**
   * Swap two player seats. ST only
   * @param payload
   */
  swapPlayer(payload) {
    if (this._isSpectator) return;
    this._send("swap", payload);
  }

  /**
   * Move a player to another seat. ST only
   * @param payload
   */
  movePlayer(payload) {
    if (this._isSpectator) return;
    this._send("move", payload);
  }

  /**
   * Remove a player. ST only
   * @param payload
   */
  removePlayer(payload) {
    if (this._isSpectator) return;
    this._send("remove", payload);
  }

  /**
   * Create a group chat. ST only
   * @param chatId id of the chat group
   * @param players players within each chat group
   */
  sendAddGroupChat({chatId, players, playerIds}) {
    if (this._isSpectator) return;
    if (!!playerIds && !players) return;

    const allPlayersId = this._store.state.session.groupChats
      .filter(group => group.id === chatId)[0].players
      .map(player => player.id);
    const newPlayersId = players.map(player => player.id);
    const oldPlayersId = allPlayersId.filter(id => !newPlayersId.includes(id));
    
    newPlayersId.forEach(playerId => {
      this._store.commit("session/addMessageQueue", {
        type: "direct",
        playerId,
        command: "addGroupChat",
        params: allPlayersId,
        id: new Date().getTime()
      });
    });
    oldPlayersId.forEach(playerId => {
      this._store.commit("session/addMessageQueue", {
        type: "direct",
        playerId,
        command: "addGroupChat",
        params: newPlayersId,
        id: new Date().getTime()
      });
    });
  }

  /**
   * Remove a group chat. ST only
   * @param playerIds all ids for them to remove group chat.
   */
  sendRemoveGroupChat({playerIds}) {
    if (this._isSpectator) return;
    if (!playerIds) return;
    
    playerIds.forEach(id => {
      this._store.commit("session/addMessageQueue", {
        type: "direct",
        playerId: id,
        command: "removeGroupChat",
        // params: chatId, // temporarily removing chatId since every user has their own id
        id: new Date().getTime()
      });
    });
  }

  /**
   * Remove members from a group chat. ST only
   * @param chatId id of the chat group
   * @param player player within the chat group
   */
  sendRemoveGroupChatMember({chatId, player}) {
    if (this._isSpectator) return;
    
    this._store.commit("session/addMessageQueue", {
      type: "direct",
      playerId: player.id,
      command: "removeGroupChat",
      // params: chatId, // temporarily removing chatId since every user has their own id
      id: new Date().getTime()
    });
    
    const index = this._store.state.session.groupChats.findIndex(group => group.id === chatId);
    if (index === -1) return;
    this._store.state.session.groupChats[index].players.forEach(member => {
      if (member.id === player.id) return;
      this._store.commit("session/addMessageQueue", {
        type: "direct",
        playerId: member.id,
        command: "removeGroupChatMember",
        params: player.id,
        id: new Date().getTime()
      });
    });
  }

  /**
   * Update group chat.
   * @param payload
   */
  _handleChat({message, sendingPlayerId, receivingPlayerId}, feedback){
    if (feedback) {
      this._request("deleteMessage", this._store.state.session.playerId, ["direct", feedback]);
      if (this._store.state.session.messageUniqueQueue[feedback]) return;
      this._store.commit("session/checkUniqueMessage", feedback);
    }
    if (this._isSpectator && receivingPlayerId != this._store.state.session.playerId) return;
    this._store.commit("session/updateChatReceived", {message, playerId: sendingPlayerId});
    const num = 1;
    if (!this._isSpectator){
      this._store.commit("players/setPlayerMessage", {playerId: sendingPlayerId, num});
    } else{
      this._store.commit("session/setStMessage", num);
    }

    if (this._isSpectator) return;

    const players = this._store.state.players.players;
    const sendingPlayer = players.filter(player => player.id === sendingPlayerId);
    if (sendingPlayer.length <= 0) return;
    const chatId = sendingPlayer[0].chatGroup;

    const wraiths = players.filter(player => player.isWraith && player.isUsingWraith && player.isAllowRole && !!player.id);
    const sendingPlayerIndex = players.findIndex(player => player.id === sendingPlayerId);
    const wraithMessage = `[亡魂][（${sendingPlayerIndex+1}号）${message}]`;
    wraiths.forEach(player => {
      if (!(player.id === sendingPlayerId || (player.chatGroup && player.chatGroup === chatId))) this._store.commit("session/updateChatSent", {message: wraithMessage, sendingPlayerId: this._store.state.session.playerId, receivingPlayerId: player.id});
    });
    // 处理暴露
    const prob = this._store.state.session.isRole.wraith.prob;
    const rand = Math.random();
    if (rand < prob && wraiths.length > 0) {
      const randIndex = Math.floor(Math.random() * wraiths.length);
      const wraithSpotted = wraiths[randIndex];
      const indexSpotted = players.findIndex(player => player.id === wraithSpotted.id);
      const spottedMessage = `[亡魂][亡魂是（${indexSpotted+1}号）${players[indexSpotted].name}]`;
      this._store.commit("session/updateChatSent", {message: spottedMessage, sendingPlayerId: this._store.state.session.playerId, receivingPlayerId: sendingPlayerId});
      const indexExposed = players.findIndex(player => player.id === sendingPlayerId);
      const exposedMessage = `[亡魂][你已被${indexExposed+1}号发现！！]`;
      this._store.commit("session/updateChatSent", {message: exposedMessage, sendingPlayerId: this._store.state.session.playerId, receivingPlayerId: wraithSpotted.id});
    }

    if (chatId === "") return;

    const groupChats = this._store.state.session.groupChats;
    if (groupChats.length === 0) return;

    const group = groupChats.filter(group => group.id === chatId)[0];
    const sendPlayers = group.players
      .map(player => player.id)
      .filter(id => id != sendingPlayerId);
    sendPlayers.forEach(id => {
      this._store.commit("session/updateChatSent", {message, sendingPlayerId: this._store.state.session.playerId, receivingPlayerId: id});
    });
  }
  
  /**
   * Create a chat group or add new members
   * @param playerIds list of ids to add to the group chat.
   */
  _handleAddGroupChat(playerIds, feedback = false){
    if (feedback) {
      this._request("deleteMessage", this._store.state.session.playerId, ["direct", feedback]);
      if (this._store.state.session.messageUniqueQueue[feedback]) return;
      this._store.commit("session/checkUniqueMessage", feedback);
    }
    if (!this._isSpectator) return;

    const groupChats = this._store.state.session.groupChats;
    const names = this._store.state.players.players
      .filter(player => playerIds.includes(player.id))
      .map(player => {
        return {
          index: this._store.state.players.players.findIndex(player2 => player2.id === player.id), 
          name: player.name
        }
      });
    const sendingPlayerId = this._store.state.session.stId;
    const receivingPlayerId = this._store.state.session.playerId;

    if (groupChats.length === 0) {
      let message = "[你已加入群聊！]";
      this._handleChat({message, sendingPlayerId, receivingPlayerId}, null);

      message = "[群聊中有";
      for (let i=0; i<names.length; i++) {
        message += `（${names[i].index+1}号）${names[i].name}`;
        if (i<names.length-1) message += "、";
      }
      message += "]";
      this._handleChat({message, sendingPlayerId, receivingPlayerId}, null);
    } else {
      let message = "[";
      for (let i=0; i<names.length; i++) {
        message += `（${names[i].index+1}号）${names[i].name}`;
        if (i<names.length-1) message += "、";
      }
      message += "加入群聊！]";
      this._handleChat({message, sendingPlayerId, receivingPlayerId}, null);
    }

    const chatId = groupChats.length === 0 ? Math.random().toString(36).substr(2) : groupChats[0].id;
    const players = this._store.state.players.players.filter(player => {
      return playerIds.includes(player.id);
    });
    this._store.commit("session/addGroupChat", {chatId, players});

  }
  
  /**
   * Exit the group chat
   * @param chatId single group chat id to be removed from the list.
   */
  _handleRemoveGroupChat(feedback = false){
    if (feedback) {
      this._request("deleteMessage", this._store.state.session.playerId, ["direct", feedback]);
      if (this._store.state.session.messageUniqueQueue[feedback]) return;
      this._store.commit("session/checkUniqueMessage", feedback);
    }
    if (!this._isSpectator) return;

    const groupChats = this._store.state.session.groupChats;
    if (groupChats.length === 0) return;
    
    const sendingPlayerId = this._store.state.session.stId;
    const receivingPlayerId = this._store.state.session.playerId;

    const message = "[你已退出群聊！]";
    this._handleChat({message, sendingPlayerId, receivingPlayerId}, null);

    const chatId = groupChats[0].id;
    this._store.commit("session/removeGroupChat", {chatId});

  }
  
  /**
   * Remove a member (not self) from the group chat
   * @param playerId single id of player to be removed from the group.
   */
  _handleRemoveGroupChatMember(playerId, feedback = false){
    if (feedback) {
      this._request("deleteMessage", this._store.state.session.playerId, ["direct", feedback]);
      if (this._store.state.session.messageUniqueQueue[feedback]) return;
      this._store.commit("session/checkUniqueMessage", feedback);
    }
    if (!this._isSpectator) return;

    const groupChats = this._store.state.session.groupChats;
    if (groupChats.length === 0) return;
    const player = groupChats[0].players.filter(player => {return player.id === playerId})[0];
    const index = groupChats[0].players.findIndex(player2 => player2.id === playerId);
    
    const sendingPlayerId = this._store.state.session.stId;
    const receivingPlayerId = this._store.state.session.playerId;

    const message = `[（${index+1}号）${player.name}退出群聊！]`;
    this._handleChat({message, sendingPlayerId, receivingPlayerId}, null);


    const chatId = groupChats[0].id;
    this._store.commit("session/removeGroupChatMember", {chatId, player});
  }

  /**
   * Sync seated player status.
   * @param isSecretVoteless boolean says if this player is secretly voteless.
   * @param groupChat list of latest player ID in the group chat.
   */
  _handleSyncPlayerStatus({isSecretVoteless, groupChatPlayers, isWraith, isUsingWraith}) {
    if (!this._isSpectator) return;
    if (this._store.state.session.claimedSeat === -1) return;

    if (this._store.state.session.isSecretVote && isSecretVoteless) {
      this._store.commit("players/update", { 
        player: this._store.state.players.players[this._store.state.session.claimedSeat],
        property: "isVoteless",
        value: isSecretVoteless
       });
    }

    const groupChats = this._store.state.session.groupChats;
    if (groupChatPlayers.length > 0) {
      if (groupChats.length > 0) {
        groupChats[0].players.forEach(player => {
          if (!groupChatPlayers.includes(player.id)) this._handleRemoveGroupChatMember(player.id);
        });
        const inGroupPlayers = groupChats[0].players.map(player => player.id);
        const addPlayers = groupChatPlayers.filter(id => !inGroupPlayers.includes(id));
        if (addPlayers.length > 0) this._handleAddGroupChat(addPlayers);
      } else {
        this._handleAddGroupChat(groupChatPlayers);
      }
    } else {
      if (groupChats.length > 0) this._handleRemoveGroupChat();
    }

    this._store.commit("session/setIsRole", {
      role: 'wraith',
      property: 'active',
      value: isWraith
    });
    this._store.commit("session/setIsRole", {
      role: 'wraith',
      property: 'using',
      value: isUsingWraith,
      st: true
    });
  }

  /**
   * Send out timer.
   * @param payload
   */
  setTimer(payload) {
    if (this._isSpectator) return;
    this._send("setTimer", payload);
  }

  /**
   * Update timer when received.
   * @param payload
   */
  _handleSetTimer(time){
    this._store.commit("session/setTimer", time);
  }

  /**
   * Send out starting timer.
   * @param payload
   */
  startTimer(payload) {
    if (this._isSpectator) return;
    this._send("startTimer", payload);
  }

  /**
   * Starting timer.
   */
  _handleStartTimer(payload){
    this._store.commit("session/startTimer", payload);
  }

  /**
   * Send out starting timer.
   * @param payload
   */
  stopTimer(payload) {
    if (this._isSpectator) return;
    this._send("stopTimer", payload);
  }

  /**
   * Starting timer.
   */
  _handleStopTimer(){
    this._store.commit("session/stopTimer");
  }
}

class LiveLobby {
  constructor(store) {
    this._wss = "wss://ws.botcgrimoire.top:443/lobby/";
    // this._wss = "ws://localhost:8082/"; // uncomment if using local server with NODE_ENV=development
    this._socket = null;
    this._isSpectator = true;
    this._isAlive = true;
    this._store = store;
    this._pingInterval = 3 * 1000; // 30 seconds between pings
    this._pingTimer = null;
    this._reconnectTimer = null;
    this._pings = {}; // map of player IDs to ping
  }

  async safeConnect(url) {
    try {
      // Change wss:// to https:// for a quick ping
      const httpUrl = 'https://botcgrimoire.top/';
      const response = await fetch(httpUrl, { method: 'HEAD', mode: 'no-cors' });
      return response ? new WebSocket(url) : null;
    } catch (e) {
      return null;
    }
  }

  /**
   * Open a new session for lobby.
   * @private
   */
  async _open() {
    this.disconnect();
    this._socket = await this.safeConnect(
      this._wss + 
      this._store.state.session.playerId
    );
    if (this._socket === null) {
      this._store.commit("session/setReconnecting", true);
      this._reconnectTimer = setTimeout(
        () => this.connect(),
        3 * 1000
      );
      return;
    }
    this._socket.addEventListener("message", this._handleMessage.bind(this));
    this._socket.onopen = this._onOpen.bind(this);
    this._socket.onclose = err => {
      this._socket = null;
      clearTimeout(this._pingTimer);
      this._pingTimer = null;
      if (err.code !== 1000) {
        // connection interrupted, reconnect after 3 seconds
        this._reconnectTimer = setTimeout(
          () => this.connect(),
          3 * 1000
        );
      } else {
        this._store.commit("session/setSessionId", "");
        if (err.reason) {
          this.showInputModal({
            inputType: "alert",
            inputModal: "text",
            inputData: {
              name: [err.reason],
            }
          }).catch(() => {
            return null;
          });
        }
      }
    };
  }

  /**
   * Send a message through the socket.
   * @param command
   * @param params
   * @private
   */
  _send(command, params, feedback = false) {
    if (this._socket && this._socket.readyState === 1) {
      this._socket.send(JSON.stringify([command, params, feedback]));
    }
  }

  /**
   * Send a message directly to a single playerId, if provided.
   * Otherwise broadcast it.
   * @param playerId player ID or "host", optional
   * @param command
   * @param params
   * @private
   */
  _sendDirect(playerId, command, params, feedback = false) {
    if (playerId) {
      this._send("direct", { [playerId]: [command, params]}, feedback);
    } else {
      this._send(command, params, feedback);
    }
  }

  _onOpen() {
    console.log('Welcome!');
  }

  _handleMessage({ data }) {
    let command, params;
    try {
      [command, params] = JSON.parse(data);
    } catch (err) {
      console.log("unsupported socket message", data);
    }
    switch (command) {
      case "setRooms":
        this.setRooms(params);
        break;
      case "addRoom":
        this.addRoom(params);
        break;
      case "removeRoom":
        this.removeRoom(params);
        break;
    }
  }

  /**
   * Connect to a new live session to the lobby to receive information about available rooms.
   * Set a unique playerId if there isn't one yet.
   */
  connect() {
    if (!this._store.state.session.playerId) {
      let playerId;
      // 禁止host、_host、lobby、player和default作为playerId
      while (!playerId || playerId === "host" || playerId === "_host" || playerId === "player" || playerId === "default") {
        playerId = Math.random().toString(36).substr(2);
      }
      this._store.commit(
        "session/setPlayerId",
        playerId
      );
    }
    this._pings = {};
    this._store.commit("session/setPlayerCount", 0);
    this._store.commit("session/setPing", 0);
    this._isSpectator = this._store.state.session.isSpectator;
    if (this._store.state.session.claimedSeat >= 0) {
      this._store.commit("session/setTalking", {seatNum: this._store.state.session.claimedSeat, isTalking: false});
    }
    this._open();
  }

  /**
   * Close the current session, if any.
   */
  disconnect() {
    this._pings = {};
    this._store.commit("session/setPlayerCount", 0);
    this._store.commit("session/setPing", 0);
    this._store.commit("session/setReconnecting", false);
    clearTimeout(this._reconnectTimer);
    if (this._socket) {
      if (this._isSpectator) {
        this._sendDirect("host", "bye", this._store.state.session.playerId);
      }
      this._socket.close(1000);
      this._socket = null;
    }
  }

  /**
   * Set the full list of available rooms
   * @param params full list of all existing channels
   * @private
   */
  setRooms(params) {
    if (!Array.isArray(params)) return;
    this._store.state.session.rooms = params;
  }

  /**
   * Add rooms to the existing list
   * @param params full list of all existing channels
   * @private
   */
  addRoom(params) {
    if (typeof params != "string") return;
    if (this._store.state.session.rooms.includes(params)) return;
    this._store.state.session.rooms.push(params);
  }

  /**
   * Remove rooms from the existing list
   * @param params full list of all existing channels
   * @private
   */
  removeRoom(params) {
    if (typeof params != "string") return;
    this._store.state.session.rooms = this._store.state.session.rooms.filter(room => room != params);
  }
}

export default store => {

  // lobby
  const lobby = new LiveLobby(store);
  if (window.location.pathname === "/") lobby.connect();
  // setup
  const session = new LiveSession(store);

  // listen to mutations
  store.subscribe(({ type, payload }, state) => {
    switch (type) {
      case "session/setSessionId":
        if (state.session.sessionId) {
          session.connect(state.session.sessionId);
        } else {
          session.disconnect();
        }
        break;
      case "session/claimSeat":
        session.claimSeat(payload);
        break;
      case "session/distributeRoles":
        if (payload) {
          session.distributeRoles();
        }
        break;
      case "session/distributeTypes":
        if (payload) {
          session.distributeTypes();
        }
        break;
      case "session/distributeBluffs":
        if (payload) {
          session.distributeBluffs(payload);
        }
        break;
      case "session/distributeGrimoire":
        if (payload) {
          session.distributeGrimoire(payload);
        }
        break;
      case "session/nomination":
      case "session/setNomination":
        session.nomination(payload);
        break;
      case "session/setVoteInProgress":
        session.setVoteInProgress(payload);
        break;
      case "session/voteSync":
        session.vote(payload);
        break;
      case "session/lockVote":
        session.lockVote();
        break;
      case "session/setVotingSpeed":
        session.setVotingSpeed(payload);
        break;
      // case "session/clearVoteHistory":
      //   session.clearVoteHistory();
      //   break;
      case "session/setVoteHistoryAllowed":
        session.setVoteHistoryAllowed();
        break;
      case "toggleNight":
        session.setIsNight();
        break;
      case "setEdition":
        session.sendEdition();
        break;
      case "setStates":
        session.sendStates();
        break;
      case "setTeamsNames":
        session.sendTeamsNames();
        break;
      case "setFirstNight":
        session.sendFirstNight();
        break;
      case "setOtherNight":
        session.sendOtherNight();
        break;
      case "players/setFabled":
        session.sendFabled();
        break;
      case "session/setMarkedPlayer":
        session.setMarked(payload);
        break;
      case "players/swap":
        session.swapPlayer(payload);
        break;
      case "players/move":
        session.movePlayer(payload);
        break;
      case "players/remove":
        session.removePlayer(payload);
        break;
      case "players/set":
      case "players/clear":
      case "players/add":
        session.sendGamestate("", true);
        break;
      case "players/update":
        if (payload.property === "pronouns") {
          session.sendPlayerPronouns(payload);
        } else {
          session.sendPlayer(payload);
        }
        break;
      case "players/empty":
        session.emptyPlayer(payload);
        break;
      case "session/addGroupChat":
        session.sendAddGroupChat(payload);
        break;
      case "session/removeGroupChat":
        session.sendRemoveGroupChat(payload);
        break;
      case "session/removeGroupChatMember":
        session.sendRemoveGroupChatMember(payload);
        break;
      case "session/addMessageQueue":
        session._startSendQueue();
        break;
      case "session/deleteMessageQueue":
        if (session._store.state.session.messageQueue.length <= 0) session._stopSendQueue();
        break;
      case "session/setTimer":
        session.setTimer(payload);
        break;
      case "session/startTimer":
        session.startTimer(payload);
        break;
      case "session/stopTimer":
        session.stopTimer(payload);
        break;
      case "session/setPlayerAvatar":
        session.uploadAvatar(payload);
        break;
      case "session/setSecretVote":
        session.setSecretVote(payload);
        break;
      case "session/setUseOldOrder":
        session.setUseOldOrder(payload);
        break;
      case "session/setUseOldRole":
        session.setUseOldRole(payload);
        break;
      case "session/setIsReview":
        session.setIsReview(payload);
        if (payload) session.distributeGrimoire({all: true});
        break;
      // case "session/setBootlegger":
      //   session.setBootlegger(payload);
      //   break;
      case "session/setTalking":
        session.setTalking(payload);
        break;
      case "session/setIsRole":
        session.setIsRole(payload);
        break;
    }
  });
};

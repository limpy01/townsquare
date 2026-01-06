module.exports = store => {
  if (window.location.pathname != "/") return;

  const updatePagetitle = isPublic =>
    // (document.title = `Blood on the Clocktower ${
    //   isPublic ? "Town Square" : "Grimoire"
    // }`);
    (document.title = `编程分享：钟楼谜团 ${
      isPublic ? "" : ""
    }`);

  // initialize data
  if (localStorage.getItem("lastVersion")) {
    store.commit("setLastVersion", localStorage.getItem("lastVersion"));
  }
  if (localStorage.getItem("background")) {
    store.commit("setBackground", localStorage.background);
  }
  if (localStorage.getItem("muted")) {
    store.commit("toggleMuted", true);
  }
  if (localStorage.getItem("static")) {
    store.commit("toggleStatic", true);
  }
  if (localStorage.getItem("imageOptIn")) {
    store.commit("toggleImageOptIn", true);
  }
  if (localStorage.getItem("zoom")) {
    store.commit("setZoom", parseFloat(localStorage.getItem("zoom")));
  }
  if (localStorage.getItem("audioThreshold")) {
    store.commit("setAudioThreshold", localStorage.getItem("audioThreshold"));
  }
  if (localStorage.getItem("isGrimoire")) {
    store.commit("toggleGrimoire", false);
    updatePagetitle(false);
  }
  if (localStorage.getItem("useOldOrder")) {
    store.commit("session/setUseOldOrder", JSON.parse(localStorage.getItem("useOldOrder")));
  }
  if (localStorage.getItem("useOldRole")) {
    store.commit("session/setUseOldRole", JSON.parse(localStorage.getItem("useOldRole")));
  }
  if (localStorage.getItem("isReview")) {
    store.commit("session/setIsReview", JSON.parse(localStorage.getItem("isReview")));
  }
  if (localStorage.getItem("selectedEditions")) {
    store.commit("setSelectedEditions", JSON.parse(localStorage.getItem("selectedEditions")));
  }
  if (localStorage.roles !== undefined) {
    store.commit("setCustomRoles", JSON.parse(localStorage.roles));
    store.commit("setEdition", { id: "custom" });
  }
  if (localStorage.getItem("states")) {
    store.commit("setStates", JSON.parse(localStorage.states));
  }
  if (localStorage.getItem("teamsNames")) {
    store.commit("setTeamsNames", JSON.parse(localStorage.teamsNames))
  }
  if (localStorage.getItem("firstNight")) {
    store.commit("setFirstNight", JSON.parse(localStorage.firstNight))
  }
  if (localStorage.getItem("otherNight")) {
    store.commit("setOtherNight", JSON.parse(localStorage.otherNight))
  }
  if (localStorage.edition !== undefined) {
    // this will initialize state.roles for official editions
    store.commit("setEdition", JSON.parse(localStorage.edition));
  }
  if (localStorage.bluffs !== undefined) {
    JSON.parse(localStorage.bluffs).forEach((role, index) => {
      store.commit("players/setBluff", {
        index,
        role: store.state.roles.get(role) || {}
      });
    });
  }
  if (localStorage.getItem("playerProfileImage")) {
    localStorage.setItem("playerAvatar", localStorage.getItem("playerProfileImage"));
    localStorage.removeItem("playerProfileImage");
  }
  if (localStorage.fabled !== undefined) {
    store.commit("players/setFabled", {
      // fabled: JSON.parse(localStorage.fabled).map(
      //   fabled => store.state.fabled.get(fabled.id) || fabled
      // )
      fabled: JSON.parse(localStorage.fabled),
      emptyFabled: true
    });
  }
  if (localStorage.players) {
    store.commit(
      "players/set",
      JSON.parse(localStorage.players).map(player => ({
        ...player,
        role:
          store.state.roles.get(player.role) ||
          store.getters.rolesJSONbyId.get(player.role) ||
          {}
      }))
    );
  }
  /**** Session related data *****/
  if (localStorage.getItem("playerId")) {
    store.commit("session/setPlayerId", localStorage.getItem("playerId"));
  }
  if (localStorage.getItem("playerName")) {
    store.commit("session/setPlayerName", localStorage.getItem("playerName"));
  }
  if (localStorage.getItem("stId")) {
    store.commit("session/setStId", localStorage.getItem("stId"));
  }
  if (localStorage.getItem("claimedSeat")) {
    store.commit("session/claimSeat", Number(localStorage.getItem("claimedSeat")));
  }
  if (localStorage.getItem("session")) {
    const [spectator, sessionId] = JSON.parse(localStorage.getItem("session"));
    store.commit("session/setSpectator", spectator);
    store.commit("session/setSessionId", sessionId);
  }
  if (localStorage.getItem("playerVotes")) {
    store.commit("session/setPlayerVotes", JSON.parse(localStorage.getItem("playerVotes")));
  }
  if (localStorage.getItem("votes")) {
    const votes = JSON.parse(localStorage.getItem("votes"));
    votes.forEach(voteHistory => {
      store.commit("session/addVotes", voteHistory);
    })
  }
  if (localStorage.getItem("votesSelected")) {
    const votesSelected = JSON.parse(localStorage.getItem("votesSelected"));
    votesSelected.forEach(voteSelected => {
      store.commit("session/addVoteSelected", voteSelected);
    })
  }
  if (localStorage.getItem("customBootlegger")) {
    const customBootlegger = JSON.parse(localStorage.getItem("customBootlegger"));
    store.commit("session/setBootlegger", customBootlegger);
  }
  if (localStorage.getItem("chatHistory")) {
    const chatHistory = JSON.parse(localStorage.getItem("chatHistory"));
    chatHistory.forEach(player => {
      store.commit("session/createChatHistory", player.id);
      player.chat.forEach(message => {
        store.commit("session/updateChatReceived", {message, playerId: player.id});
      })
    })
  }
  if (localStorage.getItem("groupChats")) {
    const groupChats = JSON.parse(localStorage.getItem("groupChats"));
    groupChats.forEach(group => {
      store.commit("session/addGroupChat", {
        chatId: group.id,
        playerIds: group.playerIds,
        keep: group.keep
      });
    });
  }
  if (localStorage.getItem("playerAvatar")) {
    store.commit("session/updatePlayerAvatar", localStorage.getItem("playerAvatar"));
  }
  if (localStorage.getItem("secretVote")) {
    store.commit("session/setSecretVote", JSON.parse(localStorage.getItem("secretVote")));
  }
  if (localStorage.getItem("isRole")) {
    const isRole = JSON.parse(localStorage.getItem("isRole"));
    const role = Object.keys(isRole)[0];
    for(const property in isRole[role]) {
      store.commit("session/setIsRole", {
        role,
        property,
        value: isRole[role][property],
        st: true
      });
    }
  }
  // listen to mutations
  store.subscribe(({ type, payload }, state) => {
    switch (type) {
      case "toggleGrimoire":
        if (!state.grimoire.isPublic) {
          localStorage.setItem("isGrimoire", 1);
        } else {
          localStorage.removeItem("isGrimoire");
        }
        updatePagetitle(state.grimoire.isPublic);
        break;
      case "setLastVersion":
        if (payload) {
          localStorage.setItem("lastVersion", payload);
        } else {
          localStorage.removeItem("lastVersion");
        }
        break;
      case "setBackground":
        if (payload) {
          localStorage.setItem("background", payload);
        } else {
          localStorage.removeItem("background");
        }
        break;
      case "toggleMuted":
        if (state.grimoire.isMuted) {
          localStorage.setItem("muted", 1);
        } else {
          localStorage.removeItem("muted");
        }
        break;
      case "toggleStatic":
        if (state.grimoire.isStatic) {
          localStorage.setItem("static", 1);
        } else {
          localStorage.removeItem("static");
        }
        break;
      case "toggleImageOptIn":
        if (state.grimoire.isImageOptIn) {
          localStorage.setItem("imageOptIn", 1);
        } else {
          localStorage.removeItem("imageOptIn");
        }
        break;
      case "setZoom":
        if (payload !== 0) {
          localStorage.setItem("zoom", payload);
        } else {
          localStorage.removeItem("zoom");
        }
        break;
      case "setAudioThreshold":
        localStorage.setItem("audioThreshold", payload);
        break;
      case "setSelectedEditions":
        localStorage.setItem("selectedEditions", JSON.stringify(payload));
        break;
      case "setEdition":
        localStorage.setItem("edition", JSON.stringify(payload));
        if (state.edition.isOfficial) {
          localStorage.removeItem("roles");
        }
        break;
      case "setCustomRoles":
        if (!payload.length) {
          localStorage.removeItem("roles");
        } else {
          localStorage.setItem("roles", JSON.stringify(payload));
        }
        break;
      case "setStates":
        localStorage.setItem("states", JSON.stringify(payload));
        break;
      case "setTeamsNames":
        localStorage.setItem("teamsNames", JSON.stringify(payload));
        break;
      case "setFirstNight":
        localStorage.setItem("firstNight", JSON.stringify(payload));
        break;
      case "setOtherNight":
        localStorage.setItem("otherNight", JSON.stringify(payload));
        break;
      case "players/setBluff":
      case "players/updateBluff":
        localStorage.setItem(
          "bluffs",
          JSON.stringify(state.players.bluffs.map(({ id }) => id))
        );
        break;
      case "players/setFabled":
        localStorage.setItem(
          "fabled",
          JSON.stringify(state.players.fabled)
        );
        break;
      case "players/add":
      case "players/update":
      case "players/remove":
      case "players/clear":
      case "players/set":
      case "players/swap":
      case "players/move":
        if (state.players.players.length) {
          localStorage.setItem(
            "players",
            JSON.stringify(
              state.players.players.map(player => ({
                ...player,
                // simplify the stored data
                role: player.role.id || {}
              }))
            )
          );
        } else {
          localStorage.removeItem("players");
        }
        break;
      case "session/setSessionId":
        if (payload) {
          localStorage.setItem(
            "session",
            JSON.stringify([state.session.isSpectator, payload])
          );
        } else {
          localStorage.removeItem("session");
        }
        break;
      case "session/setPlayerId":
        if (payload) {
          localStorage.setItem("playerId", payload);
        } else {
          localStorage.removeItem("playerId");
        }
        break;
      case "session/setPlayerName":
        if (payload) {
          localStorage.setItem("playerName", payload);
        } else {
          localStorage.removeItem("playerName");
        }
        break;
      case "session/setStId":
        localStorage.setItem("stId", payload);
        break;
      case "session/claimSeat":
        if (payload >= 0) {
          localStorage.setItem("claimedSeat", payload);
        } else {
          localStorage.removeItem("claimedSeat");
        }
        break;
      case "session/setPlayerVotes":
        localStorage.setItem("playerVotes", JSON.stringify(payload));
        break;
      case "session/addVotes": {
        if (payload.save) {
          const votes = localStorage.getItem("votes") ? JSON.parse(localStorage.getItem("votes")) : [];
          payload.save = false;
          votes.push(payload);
          localStorage.setItem("votes", JSON.stringify(votes));
        }
        break;
      }
      case "session/addVoteSelected": {
        if (payload.save) {
          const votesSelected = localStorage.getItem("votesSelected") ? JSON.parse(localStorage.getItem("votesSelected")) : [];
          payload.save = false;
          delete payload.players; // players added for conditioning in session
          votesSelected.push(payload);
          localStorage.setItem("votesSelected", JSON.stringify(votesSelected));
        }
        break;
      }
      case "session/clearVoteHistory": {
        if (!localStorage.getItem("votes")) break;
        if (!localStorage.getItem("votesSelected")) break;
        if (!payload || payload.length === 0) {
          localStorage.removeItem("votes");
          localStorage.removeItem("votesSelected");
        } else {
          const votes = JSON.parse(localStorage.getItem("votes"));
          const votesSelected = JSON.parse(localStorage.getItem("votesSelected"))
          const newVotes = votes.filter((_, index) => !payload.includes(index));
          const newVotesSelected = votesSelected.filter((_, index) => !payload.includes(index));
          localStorage.setItem("votes", JSON.stringify(newVotes));
          localStorage.setItem("votesSelected", JSON.stringify(newVotesSelected));
        }
        break;
      }
      case "session/setBootlegger":
        localStorage.setItem("customBootlegger", JSON.stringify(payload));
        break;
      case "session/createChatHistory":
      case "session/updateChatSent":
      case "session/updateChatReceived":
        if (state.session.chatHistory) {
          localStorage.setItem("chatHistory", JSON.stringify(state.session.chatHistory));
        } else {
          localStorage.removeItem("chatHistory");
        }
        break;
      case "session/addGroupChat":
        {
          if (!!payload.playerIds && !payload.players) return;
          const chatId = payload.chatId;
          const playerIds = payload.players.map(player => player.id);
          const groupChats = localStorage.groupChats != undefined ? JSON.parse(localStorage.getItem("groupChats")) : [];
          const chats = groupChats.map(group => group.id);
          if (chats.includes(chatId)) {
            const group = groupChats.filter(group => group.id === chatId)[0];
            playerIds.forEach(id => {
              if (group.playerIds.includes(id)) return;
              group.playerIds.push(id);
            });
          } else {
            groupChats.push({
              id: chatId,
              playerIds,
              keep: false
            });
          }
          localStorage.setItem("groupChats", JSON.stringify(groupChats));
        }
        break;
      case "session/removeGroupChat":
        if (localStorage.groupChats != undefined) {
          const groupChats = JSON.parse(localStorage.getItem("groupChats"));
          const newGroupChats = groupChats.filter(group => group.id != payload.chatId);
          localStorage.setItem("groupChats", JSON.stringify(newGroupChats));
        }
        break;
      case "session/removeGroupChatMember":
        if (!!payload.playerIds && !payload.players) return;
        if (localStorage.groupChats != undefined) {
          const groupChats = JSON.parse(localStorage.getItem("groupChats"));
          const chatId = payload.chatId;
          const playerId = payload.player.id;
          const index = groupChats.findIndex(group => group.id === chatId);
          if (index === -1) return;
          
          groupChats[index].playerIds = groupChats[index].playerIds.filter(player => player != playerId);
          localStorage.setItem("groupChats", JSON.stringify(groupChats));
        }
        break;
      case "session/toggleGroupKeep":
        if (localStorage.groupChats != undefined) {
          const groupChats = JSON.parse(localStorage.getItem("groupChats"));
          const index = groupChats.findIndex(group => group.id === payload);
          if (index === -1) return;
          
          groupChats[index].keep = !groupChats[index].keep;
          localStorage.setItem("groupChats", JSON.stringify(groupChats));
        }
        break;
      case "session/updatePlayerAvatar":
        localStorage.setItem("playerAvatar", payload);
        break;
      case "session/setSecretVote":
        localStorage.setItem("secretVote", JSON.stringify(payload));
        break;
      case "session/setUseOldOrder":
        if (payload) localStorage.setItem("useOldOrder", JSON.stringify(payload));
        break;
      case "session/setUseOldRole":
        if (payload) localStorage.setItem("useOldRole", JSON.stringify(payload));
        break;
      case "session/setIsReview":
        localStorage.setItem("isReview", JSON.stringify(payload));
        break;
      case "session/setIsRole":
        {
          const role = payload.role;
          const property = payload.property;
          const value = payload.value;
          const stored = localStorage.getItem("isRole") ? true : false;
          const isRole = stored ? JSON.parse(localStorage.getItem("isRole")) : {};
          if (!stored && !!value) { // delete when value set to initial, need to pay caution with e.g. []
            isRole[role] = {[property]: value};
          } else if (isRole[role]) {
            if (!value) {
              // delete when value set to initial, need to pay caution with e.g. []
              delete isRole[role][property];
              if (Object.keys(isRole[role]).length === 0) delete isRole[role];
            } else {
              isRole[role][property] = value;
            }
          }
          if (Object.keys(isRole).length === 0) {
            localStorage.removeItem("isRole");
          } else {
            localStorage.setItem("isRole", JSON.stringify(isRole));
          }
        }
        break;
    }
  });
  // console.log(localStorage);
  // localStorage.clear();
};

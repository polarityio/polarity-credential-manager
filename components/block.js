polarity.export = PolarityComponent.extend({
  session: Ember.inject.service('session'),
  store: Ember.inject.service('store'),
  flashMessages: Ember.inject.service('flashMessages'),
  state: Ember.computed.alias('block._state'),
  details: Ember.computed.alias('block.data.details'),
  timezone: Ember.computed('Intl', function () {
    return Intl.DateTimeFormat().resolvedOptions().timeZone;
  }),
  hasManagedOptions: Ember.computed(
    'state.managedOptions.length',
    'state.managedOptions.@each.pendingDeletion',
    function () {
      return this.get('state.managedOptions').some((option) => !option.pendingDeletion);
    }
  ),
  hasUnsavedOptions: Ember.computed(
    'state.managedOptions.@each.isSaved',
    'state.managedOptions.@each.pendingDeletion',
    'state.managedOptions.length',
    function () {
      return this.get('state.managedOptions').find(
        (option) => option.isSaved === false || option.pendingDeletion
      );
    }
  ),
  init() {
    if (!this.get('block._state')) {
      this.set('block._state', {});
      this.set('state.passwordOnly', true);
      this.set('state.managedOptions', Ember.A());
      this.set('state.integrations', Ember.A());
      this.set('state.newApiKey', '');
    }

    this.loadIntegrations();
    this.reloadConfiguration();

    this._super(...arguments);
  },
  actions: {
    saveConfiguration() {
      this.saveConfiguration();
    },
    removeManagedOption(managedOptionIndex) {
      this.removeManagedOption(managedOptionIndex);
    },
    cancelConfigurationChanges() {
      const optionsToRemove = [];
      this.get('state.managedOptions').forEach((option, index) => {
        if (option.isSaved === false) {
          optionsToRemove.push(index);
        } else if (option.pendingDeletion) {
          option.set('pendingDeletion', false); // reset pending deletion state
        }
      });

      optionsToRemove.forEach((optionIndex) => {
        this.removeManagedOption(optionIndex);
      });
    },
    /**
     * Used to add/remove options to the Managed Options list
     * @param option
     * @param integrationIndex
     * @param optionIndex
     */
    toggleOption(option, integrationIndex, optionIndex) {
      this.toggleProperty(
        `state.integrations.${integrationIndex}.integrationOptions.${optionIndex}.selected`
      );

      const isSelected = option.selected;

      if (isSelected) {
        // If the option is selected, add it to managedOptions
        this.get('state.managedOptions').pushObject(
          Ember.Object.create({
            integrationName: option.integrationName,
            integrationId: option.integrationId,
            isSaved: false,
            pendingDeletion: false,
            name: option.name,
            value: option.value || '',
            id: option.id,
            adminOnly: option.adminOnly,
            userCanEdit: option.userCanEdit
          })
        );
      } else {
        // the option is not selected so we need to remove it from managedOptions
        const optionToRemove = this.get('state.managedOptions').find(
          (managedOption) => managedOption.id === option.id
        );
        this.get('state.managedOptions').removeObject(optionToRemove);
      }
    },
    /**
     * Takes the new API key value provided by the user and updates all the managed integration options
     * with the new API value.  Finally, it updates the API key value of the Polarity Credential Manager so
     * the integration can monitor if the API key is about to expire.
     * @returns {Promise<void>}
     */
    async saveApiKey() {
      let newApiKey = this.get('state.newApiKey').trim();
      if (!newApiKey) {
        this.set('state.apiKeyError', 'API Key is required');
        return;
      }
      this.set('state.allSuccess', false);
      this.set('state.apiKeyError', '');
      this.set('state.isUpdating', true);

      let managedOptions = this.get('state.managedOptions');
      let allSuccess = true;
      for (const option of managedOptions) {
        option.set('isUpdating', true);
        try {
          let response = await this.updateOption(option.id, newApiKey, true, false);
          if (response.__errorMessage) {
            option.set('errorMessage', response.__errorMessage);
            allSuccess = false;
          }
        } catch (updateError) {
          option.set('errorMessage', JSON.stringify(updateError, null, 2));
        }
        option.set('isUpdating', false);
        option.set('isUpdated', true);
      }

      // Finally, save the new api key in the credential manager itself
      const integrationId = this.get('block.integrationId');
      let response = await this.updateOption(
        `${integrationId}-apiKey`,
        newApiKey,
        true,
        false
      );
      if (response.__errorMessage) {
        this.flashMessage(
          `Failed to update API Key: ${response.__errorMessage}`,
          'danger'
        );
        allSuccess = false;
      }

      if (allSuccess) {
        this.flashMessage('All API Keys have been updated successfully', 'success');
        this.set('state.allSuccess', true);
        this.set('state.newApiKey', '');
      }

      this.set('state.isUpdating', false);
    }
  },
  removeManagedOption(managedOptionIndex) {
    const managedOption = this.get(`state.managedOptions.${managedOptionIndex}`);

    // this is an existing option so we just mark pendingDeletion to true
    if (managedOption.isSaved) {
      this.set(`state.managedOptions.${managedOptionIndex}.pendingDeletion`, true);
    } else {
      // this was newly added so we can remove it
      this.get('state.managedOptions').removeAt(managedOptionIndex);
    }

    const foundIntegrationIndex = this.get('state.integrations').findIndex(
      (integration) => integration.id === managedOption.integrationId
    );
    if (foundIntegrationIndex >= 0) {
      const foundIntegrationOptions = this.get(
        `state.integrations.${foundIntegrationIndex}.integrationOptions`
      );
      const foundOptionIndex = foundIntegrationOptions.findIndex(
        (option) => option.id === managedOption.id
      );
      if (foundOptionIndex) {
        this.set(
          `state.integrations.${foundIntegrationIndex}.integrationOptions.${foundOptionIndex}.selected`,
          false
        );
      }
    }
  },
  /**
   * Iterates over all loaded integrations creates a copy of the integration and saves
   * it into the `state.integrations` variable.  This allows us to manipulate the integration
   * objects without modifying integrations in the store directly.
   *
   * @returns {Promise<void>}
   */
  async loadIntegrations() {
    let self = this;
    let storeIntegrations = this.store.peekAll('integration');

    storeIntegrations.forEach((integration) => {
      let integrationCopy = {
        id: integration.id,
        name: integration.name,
        acronym: integration.acronym,
        status: integration.status,
        hasPasswordOption: false,
        integrationOptions: []
      };

      if (integration.integrationOptions.length > 0) {
        integration.integrationOptions.forEach((option) => {
          if (option.type === 'password') {
            integrationCopy.hasPasswordOption = true;
          }

          integrationCopy.integrationOptions.push({
            id: option.id,
            name: option.name,
            type: option.type,
            selected: false,
            integrationName: integration.name,
            integrationId: integration.id
          });
        });

        let integrations = self.get('state.integrations');
        integrations.pushObject(integrationCopy);
      }
    });
  },
  /**
   * Saves the configuration for the Polarity Credential Manager integration as a JSON string.
   *
   * @returns {Promise<void>}
   */
  async saveConfiguration() {
    const integrationId = this.get('block.integrationId');
    const optionId = `${integrationId}-configuration`;
    const optionsToManage = [];
    this.get('state.managedOptions').forEach((option) => {
      // Only save options that are not being deleted
      if (option.pendingDeletion === false) {
        optionsToManage.push({
          integrationName: option.integrationName,
          integrationId: option.integrationId,
          optionId: option.id,
          optionName: option.name
        });
      }
    });

    const optionValue = JSON.stringify(optionsToManage);

    const response = await this.updateOption(optionId, optionValue, false, true);
    if (response.ok) {
      this.flashMessage('Configuration saved successfully', 'success');
      await this.reloadConfiguration();
    }
  },
  /**
   * Updates the provided option to a new value by using the Polarity REST API.  Once the
   * option is successfully updated server-side, this method also updates the internal data store
   * used by the Polarity web application.
   *
   * @param optionId {string}, integration option id to update
   * @param newOptionValue {string}, new value for the option
   * @param userCanEdit {boolean}, true if the user can edit the option
   * @param adminOnly {boolean}, true if only the admin can edit the option
   * @returns {Promise<Response>}
   */
  async updateOption(optionId, newOptionValue, userCanEdit, adminOnly) {
    this.set('state.isUpdating', true);
    const payload = {
      data: [
        {
          id: optionId,
          type: 'integration-option',
          attributes: {
            value: newOptionValue,
            'user-can-edit': userCanEdit,
            'admin-only': adminOnly
          }
        }
      ]
    };

    let response = await fetch('/api/integration-options', {
      method: 'PATCH',
      headers: this.session.authenticatedHeaders(),
      body: JSON.stringify(payload)
    });

    let result = await response.json();

    this.set('state.isUpdating', false);

    if (!response.ok) {
      let errors = result.errors;
      let flashMessage =
        'Failed to save integration options due to invalid option values';

      for (const error of errors) {
        let pointer;
        if (error && error.source && error.source.pointer) {
          pointer = error.source.pointer;
        }

        if (pointer !== undefined) {
          flashMessage = `${error.detail}`;
        } else if (error.title !== undefined && error.detail !== undefined) {
          // E.G. "Failed to update integration options: Integration is not running"
          flashMessage = `${error.title}: ${error.detail}`;
        }
      }

      this.flashMessage(flashMessage, 'danger');
      response.__errorMessage = flashMessage;
    } else {
      // Push our updated option in the Ember store so the updated value is accessible to the rest of the
      // application
      this.store.pushPayload(payload);
    }

    return response;
  },
  /**
   * Loads the list of managed options that the Polarity Credential Manager has been configured
   * to manage.
   *
   * @returns {Promise<void>}
   */
  async reloadConfiguration() {
    let configuration;
    const integrationId = this.get('block.integrationId');
    const configurationOption = await this.store.findRecord(
      'integration-option',
      `${integrationId}-configuration`
    );

    if (
      configurationOption &&
      typeof configurationOption.value === 'string' &&
      configurationOption.value.length > 0
    ) {
      try {
        configuration = JSON.parse(configurationOption.get('value'));
      } catch (parseError) {
        this.flashMessage(
          'Error parsing configuration JSON. Please check the format.',
          'danger'
        );
      }
    }

    if (configuration) {
      this.get('state.managedOptions').clear();
      configuration.forEach((integrationConfig) => {
        let integration = this.get('state.integrations').find(
          (integration) => integration.id === integrationConfig.integrationId
        );

        let option;
        if (integration) {
          option = integration.integrationOptions.find(
            (option) => option.id === integrationConfig.optionId
          );
        }

        if (option) {
          this.get('state.managedOptions').pushObject(
            Ember.Object.create({
              integrationName: integration.name,
              integrationId: integration.id,
              isSaved: true,
              pendingDeletion: false,
              name: option.name,
              value: option.value,
              id: option.id,
              adminOnly: option.adminOnly,
              userCanEdit: option.userCanEdit
            })
          );
        }
      });
    }
  },
  /**
   * Flash a message on the screen for a specific issue
   * @param message
   * @param type 'info', 'danger', or 'success'
   */
  flashMessage(message, type = 'info') {
    this.flashMessages.add({
      message: `${this.block.acronym}: ${message}`,
      type: `unv-${type}`,
      icon:
        type === 'success'
          ? 'check-circle'
          : type === 'danger'
          ? 'exclamation-circle'
          : 'info-circle',
      timeout: 3000
    });
  }
});

Ext.define('RallyBuildLight', {
    extend: 'Rally.app.App',
    requires: [
        'Ext.data.JsonP',
        'Ext.util.TaskManager',
        'Rally.ui.NumberField'
    ],
    componentCls: 'app',

    statuses: {
        INCOMPLETE: 'INCOMPLETE',
        SUCCESS: 'SUCCESS'
    },

    layout: 'fit',

    items: [{
        itemId: 'statusIndicator',
        cls: 'status-indicator',
        border: false,
        bodyBorder: false
    }],

    initComponent: function() {
        this.callParent(arguments);

        this.on('afterrender', function() {
            this.mon(this.down('#statusIndicator').getEl(), 'click', this._onStatusIndicatorClick, this);
        }, this, {single: true});
    },

    launch: function() {
        this.setLoading(true);
        this._startPoll();
    },

    getSettingsFields: function() {
        return [{
            xtype: 'rallynumberfield',
            name: 'interval',
            label: 'Refresh Interval (seconds)',
            value: 15
        }, {
            xtype: 'rallytextfield',
            name: 'jobUrl',
            label: 'Jenkins Job URL',
            value: 'http://jenkins.server/job/jobname',
            width: 400
        }];
    },

    _startPoll: function() {
        if (this.pollTask) {
            this.pollTask.destroy();
        }

        this.pollTask = Ext.util.TaskManager.start({
            run: this._poll,
            scope: this,
            interval: (parseInt(this.getSettings().interval, 10) || 15) * 1000
        }) ;
    },

    _poll: function() {
        var jobStatuses = this._createJobStatuses(),
            me = this;

        _.each(jobStatuses, function(jobStatus) {
            Ext.data.JsonP.request({
                url: jobStatus.apiUrl,
                callbackKey: 'jsonp',
                success: function(response) {
                    jobStatus.data = response;
                    me._checkJobStatus(jobStatuses);
                },
                failure: function() {
                    if (!me.notifiedError) {
                        Rally.ui.notify.Notifier.showError({message: 'Unable to contact Jenkins: ' + jobStatus.apiUrl});
                        me.notifiedError = true; // avoid spewing notifications on every poll.
                    }
                }
            });
        });
    },

    _checkJobStatus: function(jobStatuses) {
        var status = this._getJobStatus(jobStatuses),
            statusIndicator;

        if (status !== this.statuses.INCOMPLETE) {
            statusIndicator = this.down('#statusIndicator');
            if (this.currentStatus) {
                statusIndicator.removeCls(this.currentStatus);
            }
            statusIndicator.addCls(status);
            this.currentStatus = status;
            this.jobStatuses = jobStatuses;
            this.setLoading(false);
        }
    },

    _getJobStatus: function(jobStatuses) {
        var i, jobStatus, result;

        for (i = 0; i < jobStatuses.length; i++) {
            jobStatus = jobStatuses[i];

            if (!jobStatus.data || !jobStatus.data.result) {
                return this.statuses.INCOMPLETE;
            }

            if (jobStatus.data.result !== this.statuses.SUCCESS) {
                return jobStatus.data.result;
            }
        }

        return this.statuses.SUCCESS;
    },

    _getApiUrl: function(jobUrl) {
        return jobUrl.replace(/^\s+|\s+$/g, '') + '/lastCompletedBuild/api/json';
    },

    _createJobStatuses: function(jobUrls) {
        var jobUrls = (this.getSettings().jobUrl || '').split(',');

        return _.map(jobUrls, function(jobUrl) {
            return {
                url: jobUrl,
                apiUrl: this._getApiUrl(jobUrl)
            };
        }, this);
    },

    _onStatusIndicatorClick: function() {
        _.every(this.jobStatuses, function(jobStatus) {
            if (jobStatus.data && jobStatus.data.result === this.currentStatus) {
                window.open(jobStatus.url + '/lastCompletedBuild', '_blank');
            }
        }, this);
    }
});
